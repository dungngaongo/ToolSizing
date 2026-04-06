# Sử dụng Registry nội bộ  1
FROM http://registry-lab.kcntt.net/eclipse-temurin:21-jre-alpine

WORKDIR /app

# Lấy file jar từ thư mục target (đã được tạo ra bởi stage Build Artifact ở trên)
COPY target/sizing-0.0.1-SNAPSHOT.jar app.jar

EXPOSE 8081

ENTRYPOINT ["java", "-jar", "app.jar"]
