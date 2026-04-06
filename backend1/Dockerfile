# Sử dụng JRE nhẹ để chạy ứng dụng (đã có sẵn trên server 191)
FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

# Sử dụng dấu * để lấy file jar bất kể version nào (0.0.1, 0.0.2-SNAPSHOT, v.v.)
COPY target/sizing-*.jar app.jar

# Cấu hình múi giờ Việt Nam (tùy chọn nhưng nên có)
RUN ln -sf /usr/share/zoneinfo/Asia/Ho_Chi_Minh /etc/localtime

EXPOSE 8081

# Chạy ứng dụng
ENTRYPOINT ["java", "-jar", "app.jar"]
