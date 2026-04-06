pipeline {
    agent {
        label 'sizing' 
    }

    environment {
        imageName = "sizing-test"
    }

    stages {
        stage('Info') {
            steps {
                sh """ 
                    echo "=== INFO ==="
                    whoami
                    pwd
                    ls -la
                    docker --version
                """
            }
        }
        stage('Build Artifact (Maven)') {
            steps {
                sh """
                    echo "=== STEP 1: COMPILING JAVA ==="
                    cd backend1
                    # Chạy mvn install để tạo ra file .jar trong thư mục target/
                    mvn clean install -DskipTests=true
                """
            }
        }
        stage('Build Docker Image') {
            steps {
                sh """
                    echo "=== STEP 2: PACKAGING DOCKER ==="
                    cd backend1
                    # Docker build lúc này chỉ việc lấy file .jar đã có sẵn
                    docker build --network=host -t ${imageName}:latest .
                """
            }
        }

        stage('Run Container') {
            steps {
                sh """
                    echo "=== STEP 3: DEPLOYING ==="
                    # Xóa container cũ nếu đang chạy để tránh trùng tên
                    docker rm -f sizing-test-container || true
                    docker run -d -p 8081:8081 --name sizing-test-container ${imageName}:latest
                """
            }
        }
    }
}
