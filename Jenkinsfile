pipeline {
    agent {
        label 'sizing' // Chạy trên server 191/192 của bạn
    }

    stages {
        stage('1. Build Artifact (Maven)') {
            steps {
                echo "=== ĐANG BUILD FILE JAR TRONG CONTAINER MAVEN ==="
                // Di chuyển vào thư mục chứa code Java
                dir('backend1') {
                    sh """
                        docker run --rm \
                            --network=host \
                            -v /root/.m2:/root/.m2 \
                            -v \$(pwd):/app \
                            -w /app \
                            maven:3.9-eclipse-temurin-21-alpine \
                            mvn clean install -DskipTests=true
                    """
                }
            }
        }

        stage('2. Build Docker Image') {
            steps {
                echo "=== ĐANG ĐÓNG GÓI IMAGE CUỐI CÙNG ==="
                dir('backend1') {
                    sh """
                        # Build image dựa trên Dockerfile của bạn
                        docker build -t sizing-test:latest .
                    """
                }
            }
        }

        stage('3. Deploy Container') {
            steps {
                echo "=== ĐANG KHỞI CHẠY ỨNG DỤNG ==="
                sh """
                    # Xóa container cũ nếu đang chạy để tránh trùng tên
                    docker rm -f sizing-test-container || true
                    
                    # Chạy container mới từ image vừa build
                    docker run -d -p 8081:8081 --name sizing-test-container sizing-test:latest
                """
            }
        }
    }
}
