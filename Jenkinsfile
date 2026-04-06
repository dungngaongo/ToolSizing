pipeline {
    agent { label 'sizing' }

    stages {
        stage('1. Build Artifact (Maven)') {
            steps {
                dir('backend1') {
                    sh """
                        echo "=== ĐANG BUILD BẰNG DOCKER MAVEN ==="
                        
                        docker run --rm \
                            --network=host \
                            -v /home/jenkins/settings.xml:/tmp/settings.xml \
                            -v \$(pwd):/app \
                            -w /app \
                            maven:3.9-eclipse-temurin-21-alpine \
                            mvn -s /tmp/settings.xml clean install -DskipTests=true
                    """
                }
            }
        }

        stage('2. Build & Run Application') {
            steps {
                dir('backend1') {
                    sh """
                        echo "=== ĐANG ĐÓNG GÓI VÀ CHẠY CONTAINER ==="
                        
                        # Build image từ Dockerfile
                        docker build -t sizing-test:latest .
                        
                        # Restart container
                        docker rm -f sizing-test-container || true
                        docker run -d -p 8081:8081 --name sizing-test-container sizing-test:latest
                    """
                }
            }
        }
    }
}
