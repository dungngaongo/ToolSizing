pipeline {
    agent {
        docker {
            // Thay bằng địa chỉ Maven Image trong Registry nội bộ của bạn
            image 'registry.company.com/maven:3.9.6-eclipse-temurin-21'
            label 'sizing'
            // Map file settings.xml từ máy host vào trong container
            args '-v /root/.m2/settings.xml:/root/.m2/settings.xml'
        }
    }

    stages {
        stage('Build Artifact (Inside Maven Container)') {
            steps {
                sh """
                    echo "=== BUILDING WITH DOCKER MAVEN ==="
                    cd backend1
                    mvn clean install -DskipTests=true
                """
            }
        }

        stage('Build Docker Image') {
            // Stage này cần chạy Docker lệnh của máy Host nên ta dùng agent any 
            // hoặc định nghĩa lại agent để thoát khỏi container Maven
            agent { label 'sizing' } 
            steps {
                sh """
                    echo "=== PACKAGING FINAL IMAGE ==="
                    cd backend1
                    docker build --network=host -t sizing-test:latest .
                """
            }
        }
    }
}
