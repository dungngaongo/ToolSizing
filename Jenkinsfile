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
                sh (script: """ whoami;pwd;ls -la """, label: "First stage")
            }
        }
        stage('Build') {
            steps {
                sh (script: """ ${buildScript} """, label: "Build with maven")
            }
        }
    }
}
