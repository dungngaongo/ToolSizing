# ============================================================
# Stage 1: Build
# ============================================================
FROM maven:3.9-eclipse-temurin-21-alpine AS builder

WORKDIR /build

# Copy pom.xml trước để tận dụng cache layer
COPY pom.xml ./

# Copy cấu hình Maven (dùng Nexus nội bộ)
COPY settings.xml /root/.m2/settings.xml

# Tải dependencies từ Nexus
RUN mvn dependency:go-offline -B

# Copy source code
COPY src/ src/

# Build jar
RUN mvn package -DskipTests -B

# ============================================================
# Stage 2: Runtime
# ============================================================
FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

# Tạo user non-root
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy jar từ stage build
COPY --from=builder /build/target/sizing-*.jar app.jar

# Set quyền (có thể gộp bằng --chown nhưng giữ rõ ràng)
RUN chown appuser:appgroup app.jar

USER appuser

EXPOSE 8081

ENTRYPOINT ["java", "-jar", "app.jar"]