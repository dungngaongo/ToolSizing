# ============================================================
# Stage 1: Build - Dùng image maven sẵn có (không cần tải Maven qua mvnw)
# ============================================================
FROM maven:3.9-eclipse-temurin-21-alpine AS builder

# Nhận proxy từ --build-arg để Maven tải dependencies qua proxy
ARG http_proxy
ARG https_proxy
ARG HTTP_PROXY
ARG HTTPS_PROXY
ENV http_proxy=$http_proxy \
    https_proxy=$https_proxy \
    HTTP_PROXY=$HTTP_PROXY \
    HTTPS_PROXY=$HTTPS_PROXY

# Các flag SSL bypass cho cả Aether (Maven 3.9+) và Wagon
ARG MVN_SSL_FLAGS="-Dmaven.wagon.http.ssl.insecure=true -Dmaven.wagon.http.ssl.allowall=true -Dmaven.wagon.http.ssl.ignore.validity.dates=true -Daether.connector.https.securityMode=insecure"

WORKDIR /build

# Copy pom.xml trước để cache layer dependencies
COPY pom.xml ./

# Tải dependencies trước (cache lại nếu pom.xml không đổi)
RUN mvn dependency:go-offline -B $MVN_SSL_FLAGS

# Copy toàn bộ source code và build
COPY src/ src/
RUN mvn package -DskipTests -B $MVN_SSL_FLAGS

# ============================================================
# Stage 2: Runtime - Image gọn nhẹ chỉ chứa JRE + JAR
# ============================================================
FROM eclipse-temurin:21-jre-alpine AS runtime

WORKDIR /app

# Tạo user non-root để tăng bảo mật
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder /build/target/sizing-*.jar app.jar

RUN chown appuser:appgroup app.jar
USER appuser

EXPOSE 8081

ENTRYPOINT ["java", "-jar", "app.jar"]