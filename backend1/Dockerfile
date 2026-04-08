#hehe
FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

COPY target/sizing-*.jar app.jar

# Set timezone VN
RUN ln -sf /usr/share/zoneinfo/Asia/Ho_Chi_Minh /etc/localtime

EXPOSE 8081

ENTRYPOINT ["java", "-jar", "app.jar"]
