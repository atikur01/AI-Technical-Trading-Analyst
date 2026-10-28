FROM node:20-alpine AS css
WORKDIR /src
COPY package.json package-lock.json tailwind.config.js ./
RUN npm ci
COPY wwwroot ./wwwroot
COPY Features ./Features
COPY Shared ./Shared
RUN npx tailwindcss -i wwwroot/css/input.css -o wwwroot/css/site.css --minify

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY TradingChartAnalyzer.csproj ./
RUN dotnet restore
COPY . .
COPY --from=css /src/wwwroot/css/site.css wwwroot/css/site.css
RUN dotnet publish -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app .
RUN mkdir -p logs App_Data/analysis-fallback && chown -R $APP_UID logs App_Data
ENV ASPNETCORE_HTTP_PORTS=8080 \
    ASPNETCORE_FORWARDEDHEADERS_ENABLED=true
EXPOSE 8080
USER $APP_UID
ENTRYPOINT ["dotnet", "TradingChartAnalyzer.dll"]
