pipeline {

    agent {
        label 'sizing'
    }

    environment {
        IMAGE_NAME = "sizing-test"
        IMAGE_TAG = "${BUILD_NUMBER}"
        CONTAINER_NAME = "sizing-container"
    }

    stages {

        stage('1. Build Maven') {
            steps {
                dir('backend1') {
                    sh """
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
                        echo "=== BUILD DOCKER IMAGE ==="
                        docker build -t ${IMAGE_NAME}:${IMAGE_TAG} .
                    """
                }
            }
        }

        stage('3. Stop Old Container') {
            steps {
                sh """
                    echo "=== CLEAN PORT 8081 ==="

                    docker rm -f ${CONTAINER_NAME} || true

                    # Kill container chiếm port
                    docker ps -q --filter "publish=8081" | xargs -r docker rm -f
                """
            }
        }

        stage('4. Deploy New Container') {
            steps {
                sh """
                    echo "=== RUN NEW CONTAINER ==="

                    docker run -d \
                        -p 8081:8081 \
                        --name ${CONTAINER_NAME} \
                        --restart unless-stopped \
                        ${IMAGE_NAME}:${IMAGE_TAG}
                """
            }
        }

        stage('5. Health Check') {
            steps {
                sh """
                    echo "=== HEALTH CHECK ==="

                    echo "Waiting for app to start..."
                    sleep 10

                    for i in 1 2 3 4 5
                    do
                        if curl -f http://localhost:8081 > /dev/null 2>&1; then
                            echo "App is UP!"
                            exit 0
                        fi

                        echo "Retry \$i..."
                        sleep 5
                    done

                    echo "FAILED!"
                    docker logs ${CONTAINER_NAME}
                    exit 1
                """
            }
        }
    }

    post {

        failure {
            echo "=== DEPLOY FAILED ==="
            sh "docker logs ${CONTAINER_NAME} || true"
        }

        success {
            echo "=== DEPLOY SUCCESS ==="
        }
    }
}
