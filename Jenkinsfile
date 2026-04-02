pipeline {
    agent {
        label 'sizing' // Sẽ chạy trên Agent 192 của bạn
    }

    stages {
        stage('Info') {
            steps {
                // Sử dụng script block để chạy nhiều lệnh shell
                sh(script: "whoami; pwd; ls -la", label: "First stage")
            }
        }
    }
}
