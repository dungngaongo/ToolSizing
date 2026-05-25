FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

COPY target/sizing-*.jar app.jar

# Set timezone VN
RUN ln -sf /usr/share/zoneinfo/Asia/Ho_Chi_Minh /etc/localtime

EXPOSE 8081

RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

ENTRYPOINT ["java", "-jar", "app.jar"]


## Stage 1: Build với Maven
#FROM maven:3.9-eclipse-temurin-21 AS build
#
#WORKDIR /app
#
## Copy settings.xml vào container
#COPY .m2/settings.xml /root/.m2/settings.xml
#
## Copy source code vào container
#COPY . /app
#
## Build jar
#RUN mvn -s /root/.m2/settings.xml clean package -DskipTests=true
#
## Stage 2: Chạy app
#FROM eclipse-temurin:21-jre-alpine
#
#WORKDIR /app
#
## Copy jar từ stage 1
#COPY --from=build /app/target/sizing-*.jar app.jar
#
## Set timezone VN
#RUN ln -sf /usr/share/zoneinfo/Asia/Ho_Chi_Minh /etc/localtime
#
#EXPOSE 8081
#
#ENTRYPOINT ["java", "-jar", "app.jar"]