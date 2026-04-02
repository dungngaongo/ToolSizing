pipeline {
    agent {
        label 'sizing' 
    }

    environment {
        appUser = "sizing"
        appName = "sizing"
        appVersion = "0.0.1-SNAPSHOT"
        appType = "jar"
        // Sử dụng mvn hệ thống vì bạn đã cài sẵn Maven 3.6.3 trên Agent 192
        buildScript = "cd backend1 && mvn install -DskipTests=true -o -Dmaven.repo.local=/var/lib/jenkins/.m2/repository"
    }

    stages {
        stage('Info') {
            steps {
                sh "whoami; pwd; mvn -v"
                // Kiểm tra xem thư mục repo có file parent chưa (đã check qua find rồi nên yên tâm)
                sh "ls -la /var/lib/jenkins/.m2/repository/org/springframework/boot/spring-boot-starter-parent/3.5.9/"
            }
        }
        stage('Build') {
            steps {
                sh(script: "${env.buildScript}", label: "Build with maven")
            }
        }
        stage('Post-Build Check') {
            steps {
                // Kiểm tra xem file JAR đã được tạo ra chưa
                sh "ls -la backend1/target/*.jar"
            }
        }
    }
}
