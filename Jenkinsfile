pipeline {
    agent {
        label 'sizing' 
    }

    environment {
        appUser = "sizing"
        appName = "sizing"
        appVersion = "0.0.1-SNAPSHOT"
        appType = "jar"
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
        stage('Build') {
            steps {
                sh (script: """ ${buildScript} """, label: "Build with maven")
            }
        }
    }
}
