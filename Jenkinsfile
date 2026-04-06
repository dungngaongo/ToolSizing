pipeline {
    agent {
        label 'sizing' // Chạy trực tiếp trên Agent 192 của bạn
    }

    stages {
        stage('Build Artifact (Maven)') {
            steps {
                script {
                    echo "=== STEP 1: BUILDING JAR INSIDE MAVEN CONTAINER ==="
                    // Di chuyển vào thư mục code
                    dir('backend1') {
                        sh """
                            docker run --rm \
                                --network=host \
                                -v /root/.m2:/root/.m2 \
                                -v \$(pwd):/app \
                                -w /app \
                                registry-lab.kcntt.net/maven:3.9.6-eclipse-temurin-21 \
                                mvn clean install -DskipTests=true
                        """
                    }
                }
            }
        }

        stage('Build & Run Application') {
            steps {
                echo "=== STEP 2: PACKAGING & DEPLOYING ==="
                dir('backend1') {
                    sh """
                        # Build image từ Dockerfile (đã có file .jar từ bước trên)
                        docker build -t sizing-test:latest .
                        
                        # Xóa container cũ nếu có và chạy bản mới
                        docker rm -f sizing-test-container || true
                        docker run -d -p 8081:8081 --name sizing-test-container sizing-test:latest
                    """
                }
            }
        }
    }
}
