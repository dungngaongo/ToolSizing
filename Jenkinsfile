pipeline {
    agent {
        label 'sizing'
    }}
    stages {
        stage('Info') {
            steps {
                sh (script: """ whoami;pwd;ls -la """ , label: "First stage")
            }
        }
    }
}
