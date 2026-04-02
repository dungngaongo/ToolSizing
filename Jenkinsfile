pipeline {
    agent {
        label 'sizing' // Sẽ chạy trên Agent 192 của bạn
    }

    environment {
        appUser : "sizing"
        appName : "sizing"
        appVersion : "0.0.1-SNAPSHOT"
        appType : "jar"
        processName : "${appName}-${appVersion}.${appType}"
        folderDeploy : "/data/${appUser}"
        buildScript : "mvn clean install -DskipTests=true"
    }

    stages {
        stage('Info') {
            steps {
                // Sử dụng script block để chạy nhiều lệnh shell
                sh(script: "whoami; pwd; ls -la", label: "First stage")
            }
        }
        stage('build') {
            steps {
                // Sử dụng script block để chạy nhiều lệnh shell
                sh(script: "${buildScript}", label: "Build with maven")
            }
        }
    }
}
