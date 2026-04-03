pipeline {
    agent {
        label 'sizing' 
    }

    environment {
        appUser = "sizing"
        appName = "sizing"
        appVersion = "0.0.1-SNAPSHOT"
        appType = "jar"
        imageName = "sizing-test"
        buildScript = "cd backend1 && mvn install -DskipTests=true"
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
        stage('Build Docker Image') {
            steps {
                sh """
                    echo "=== BUILD IMAGE FROM DOCKERFILE ==="
                    
                    docker build -t ${imageName}:latest .
                """
            }
        }

        stage('Run Test Container') {
            steps {
                sh """
                    echo "=== RUN CONTAINER ==="
                    
                    docker run --rm -p 8081:8081 ${imageName}:latest
                """
            }
        }
    }
}
