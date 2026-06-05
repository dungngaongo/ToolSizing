FROM registry-lab.kcntt.net/library/eclipse-temurin:21-jre-alpine

WORKDIR /app

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Vừa copy vừa phân quyền luôn, không cần cài tzdata của OS nữa
COPY --chown=appuser:appgroup target/sizing-*.jar app.jar

EXPOSE 8081

USER appuser

# Ép Java chạy theo múi giờ VN bằng tham số -Duser.timezone
ENTRYPOINT ["java", "-Duser.timezone=Asia/Ho_Chi_Minh", "-XX:+UseG1GC", "-Dfile.encoding=UTF-8", "-jar", "app.jar"]