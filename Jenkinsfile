pipeline {
    agent {
        label 'sizing'
    }

    stages {
        stage('1. Build Backend (Maven)') {
            when {
                changeset "backend1/**"
            }
            steps {
                dir('backend1') {
                    sh """
                        echo "=== BUILD BACKEND ==="
                        
                        docker run   \
                            --network=host \
                            -v /home/jenkins/settings.xml:/tmp/settings.xml \
                            -v /var/lib/jenkins/.m2:/root/.m2 \
                            -v \$(pwd):/app \
                            -w /app \
                            maven:3.9-eclipse-temurin-21-alpine \
                            mvn -s /tmp/settings.xml clean install -DskipTests=true -U
                        
                        ls -l target/
                    """
                }
            }
        }
    

        stage('1.1 SonarQube Analysis') {
            when { changeset "backend1/**" }
            steps {
                dir('backend1') {
                    withSonarQubeEnv('SonarQubeServer') {
                        sh """
                            echo "=== RUNNING SONAR SCANNER ==="
                            docker run --network=host \
                                -e SONAR_HOST_URL=\${SONAR_HOST_URL} \
                                -e SONAR_TOKEN=\${SONAR_AUTH_TOKEN} \
                                -v /home/jenkins/settings.xml:/tmp/settings.xml \
                                -v /var/lib/jenkins/.m2:/root/.m2 \
                                -v \$(pwd):/app -w /app \
                                maven:3.9-eclipse-temurin-21-alpine \
                                mvn -s /tmp/settings.xml org.sonarsource.scanner.maven:sonar-maven-plugin:5.5.0.6356:sonar \
                                -Dsonar.projectKey=sizing-backend \
                                -Dsonar.host.url=http://10.207.222.193:9000 \
                                -Dsonar.scanner.skipJreProvisioning=true
                        """
                    }

                    echo "=== WAITING FOR QUALITY GATE ==="
                    timeout(time: 5, unit: 'MINUTES') {
                        script {
                            def qg = waitForQualityGate()
                            echo "Quality Gate Status: ${qg.status}"
                            if (qg.status != 'OK') {
                                error "Pipeline dừng do Quality Gate thất bại (Status: ${qg.status})"
                            }
                        }
                    }
                }
            }
        }

        

        stage('2. Deploy Backend') {
            when {
                changeset "backend1/**"
            }
            steps {
                sh """
                    echo "=== DEPLOY BACKEND ==="

                    docker compose up -d --build backend

                    docker ps | grep backend || true
                """
            }
        }

        stage('3. Deploy Frontend (Nginx)') {
            when {
                anyOf {
                    changeset "frontend/**"
                    changeset "dashboard/**"
                    changeset "nginx/**"
                }
            }
            steps {
                sh """
                    echo "=== DEPLOY FRONTEND ==="

                    docker compose up -d --build nginx

                    docker ps | grep nginx || true
                """
            }
        }
    }
}