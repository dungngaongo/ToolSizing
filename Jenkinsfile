pipeline {

    agent {
        label 'sizing'
    }

    environment {
        IMAGE_NAME = "sizing-test"
        IMAGE_TAG = "${BUILD_NUMBER}"

        CONTAINER_BLUE = "sizing-blue"
        CONTAINER_GREEN = "sizing-green"

        ACTIVE_FILE = "/tmp/active_env"
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

        stage('3. Determine Active Environment') {
            steps {
                script {
                    def active = sh(
                        script: "cat ${ACTIVE_FILE} 2>/dev/null || echo blue",
                        returnStdout: true
                    ).trim()

                    env.CURRENT_ENV = active
                    env.NEXT_ENV = (active == "blue") ? "green" : "blue"
                }
            }
        }

        stage('4. Deploy New Version') {
            steps {
                script {
                    def port = (env.NEXT_ENV == "blue") ? "8082" : "8083"
                    def container = (env.NEXT_ENV == "blue") ? env.CONTAINER_BLUE : env.CONTAINER_GREEN

                    sh """
                        echo "=== DEPLOY ${container} ON PORT ${port} ==="

                        docker rm -f ${container} || true

                        docker run -d \
                            -p ${port}:8081 \
                            --name ${container} \
                            ${IMAGE_NAME}:${IMAGE_TAG}
                    """
                }
            }
        }

        stage('5. Health Check') {
            steps {
                script {
                    def port = (env.NEXT_ENV == "blue") ? "8082" : "8083"

                    sh """
                        echo "=== HEALTH CHECK ${port} ==="

                        for i in {1..5}
                        do
                            if curl -f http://localhost:${port} > /dev/null 2>&1; then
                                echo "App is UP!"
                                exit 0
                            fi

                            echo "Retry \$i..."
                            sleep 5
                        done

                        echo "FAILED!"
                        docker logs ${env.NEXT_ENV == "blue" ? env.CONTAINER_BLUE : env.CONTAINER_GREEN}
                        exit 1
                    """
                }
            }
        }

        stage('6. Switch Traffic') {
            steps {
                script {
                    sh """
                        echo "=== SWITCH TRAFFIC ==="

                        docker rm -f sizing-main || true

                        docker run -d \
                            -p 8081:8081 \
                            --name sizing-main \
                            ${IMAGE_NAME}:${IMAGE_TAG}
                    """

                    sh "echo ${NEXT_ENV} > ${ACTIVE_FILE}"
                }
            }
        }
    }

    post {

        failure {
            echo "=== DEPLOY FAILED → ROLLBACK ==="

            script {
                def container = (env.CURRENT_ENV == "blue") ? env.CONTAINER_BLUE : env.CONTAINER_GREEN

                sh """
                    echo "Rolling back to ${container}"

                    docker rm -f sizing-main || true

                    docker run -d \
                        -p 8081:8081 \
                        --name sizing-main \
                        ${container}
                """
            }
        }

        success {
            echo "=== DEPLOY SUCCESS ==="
        }
    }
}
