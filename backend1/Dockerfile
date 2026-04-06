# Trỏ về Registry nội bộ của công ty
FROM registry.company.com/eclipse-temurin:21-jre-alpine

WORKDIR /app

# Lấy file .jar đã build xong từ bước Maven
COPY target/sizing-0.0.1-SNAPSHOT.jar app.jar

EXPOSE 8081
ENTRYPOINT ["java", "-jar", "app.jar"]
