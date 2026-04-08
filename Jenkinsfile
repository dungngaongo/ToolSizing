pipeline {
    agent {
        label 'sizing' // Chạy trên server 191/192
    }

    stages {
        stage('1. Build Artifact (Maven)') {
            steps {
                dir('backend1') {
                    sh """
                        echo "=== ĐANG TẢI DEPENDENCY VÀ BUILD TỪ NEXUS-LAB ==="
                        
                        docker run --rm \
                            --network=host \
                            -v /home/jenkins/settings.xml:/tmp/settings.xml \
                            -v /var/lib/jenkins/.m2:/root/.m2 \
                            -v \$(pwd):/app \
                            -w /app \
                            maven:3.9-eclipse-temurin-21-alpine \
                            mvn -s /tmp/settings.xml clean install -DskipTests=true -U
                    """
                }
            }
        }

        stage('2. Build Docker Image') {
            steps {
                dir('backend1') {
                    sh """
                        echo "=== ĐANG ĐÓNG GÓI IMAGE: sizing-test:latest ==="
                        docker build -t sizing-test:latest .
                    """
                }
            }
        }

        stage('3. Deploy & Health Check') {
            steps {
                sh """
                    echo "=== ĐANG KHỞI CHẠY CONTAINER ==="
                    docker rm -f sizing-test-container || true
                    
                    docker run -d \
                        -p 8081:8081 \
                        --name sizing-test-container \
                        --restart unless-stopped \
                        sizing-test:latest
                    
                    echo "Đợi 10s để ứng dụng khởi động..."
                    sleep 10
                    docker ps | grep sizing-test-container
                """
            }
        }
        stage('4. Deploy Frontend (Nginx)') {
            steps {
                sh """
                    echo "=== DEPLOY NGINX + FRONTEND ==="

                    docker compose up -d --build --force-recreate --remove-orphans

                    echo "=== CHECK NGINX ==="
                    docker ps | grep nginx
                """
            }
        }
    }
}
