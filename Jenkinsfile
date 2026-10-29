pipeline {
    agent any

    environment {
        APP_NAME      = "notes-app"
        IMAGE_NAME    = "notes-app"
        IMAGE_TAG     = "${BUILD_NUMBER}"
        REGISTRY_PUSH = "registry.registry.svc.cluster.local:5000"
        REGISTRY_PULL = "localhost:30600"
        GIT_REPO      = "github.com/ajaysunkaranam89-ai/notesapp.git"
    }

    options {
        disableConcurrentBuilds()
        timestamps()
    }

    stages {
        stage('Check commit') {
            // Jenkins' own manifest-update commit must not start another build (avoids an endless loop)
            steps {
                script {
                    def msg = sh(script: 'git log -1 --pretty=%B', returnStdout: true).trim()
                    env.SKIP_CI = msg.contains('[skip ci]') ? 'true' : 'false'
                    if (env.SKIP_CI == 'true') {
                        currentBuild.description = 'Skipped: manifest-update commit'
                        currentBuild.result = 'NOT_BUILT'
                        echo 'Latest commit was made by Jenkins - nothing to build.'
                    }
                }
            }
        }

        stage('Test') {
            // Runs `npm test` inside the Dockerfile's "test" stage - the build fails if a test fails
            when { environment name: 'SKIP_CI', value: 'false' }
            steps {
                sh "docker build --target test -t ${IMAGE_NAME}:test ."
            }
        }

        stage('Build Image') {
            when { environment name: 'SKIP_CI', value: 'false' }
            steps {
                sh "docker build --target prod -t ${REGISTRY_PUSH}/${IMAGE_NAME}:${IMAGE_TAG} ."
            }
        }

        stage('Trivy Image Scan') {
            // Everything HIGH+ is reported; the build fails only on fixable CRITICAL findings.
            when { environment name: 'SKIP_CI', value: 'false' }
            steps {
                sh '''
                    TRIVY="docker run --rm -v /var/run/docker.sock:/var/run/docker.sock -v trivy-cache:/root/.cache aquasec/trivy:latest image --scanners vuln --ignore-unfixed --no-progress"
                    IMG=${REGISTRY_PUSH}/${IMAGE_NAME}:${IMAGE_TAG}
                    $TRIVY --severity HIGH,CRITICAL $IMG
                    $TRIVY --severity HIGH,CRITICAL --format template --template "@contrib/html.tpl" $IMG > trivy-report.html
                    $TRIVY --severity CRITICAL --exit-code 1 --format json --output /dev/null $IMG
                '''
            }
            post {
                always { archiveArtifacts artifacts: 'trivy-report.html', allowEmptyArchive: true }
            }
        }

        stage('Push Image') {
            when { environment name: 'SKIP_CI', value: 'false' }
            steps {
                sh "docker push ${REGISTRY_PUSH}/${IMAGE_NAME}:${IMAGE_TAG}"
            }
        }

        stage('Update Manifest (GitOps)') {
            // CI only changes git; Argo CD (if the Application is applied) deploys the change.
            when { environment name: 'SKIP_CI', value: 'false' }
            steps {
                withCredentials([usernamePassword(credentialsId: 'git',
                                                  usernameVariable: 'GH_USER',
                                                  passwordVariable: 'GH_TOKEN')]) {
                    sh '''
                        urlencode() { printf '%s' "$1" | sed -e 's/%/%25/g' -e 's/@/%40/g' -e 's/:/%3A/g' -e 's#/#%2F#g' -e 's/ /%20/g'; }
                        GH_USER_ENC=$(urlencode "${GH_USER}")
                        GH_TOKEN_ENC=$(urlencode "${GH_TOKEN}")
                        REPO_URL="https://${GH_USER_ENC}:${GH_TOKEN_ENC}@${GIT_REPO}"

                        git config user.email "jenkins@local"
                        git config user.name  "Jenkins"

                        # Jenkins checks out a detached HEAD - move onto the latest main before editing
                        git fetch "$REPO_URL" main
                        git checkout -B main FETCH_HEAD

                        sed -i "s|image: .*notes-app:.*|image: ${REGISTRY_PULL}/${IMAGE_NAME}:${IMAGE_TAG}|" k8s/deployment.yaml
                        sed -i "s|APP_VERSION: \\"[^\\"]*\\"|APP_VERSION: \\"${IMAGE_TAG}\\"|" k8s/configmap.yaml

                        git add k8s/deployment.yaml k8s/configmap.yaml
                        if git diff --cached --quiet; then
                            echo "Manifests already point at tag ${IMAGE_TAG} - nothing to commit."
                        else
                            git commit -m "Deploy image ${IMAGE_TAG} [skip ci]"
                            git push "$REPO_URL" main
                        fi
                    '''
                }
            }
        }
    }

    post {
        success {
            script {
                if (env.SKIP_CI == 'false') {
                    echo "Pushed ${REGISTRY_PUSH}/${IMAGE_NAME}:${IMAGE_TAG} and updated the manifests in git."
                }
            }
        }
        cleanup {
            sh "docker rmi ${REGISTRY_PUSH}/${IMAGE_NAME}:${IMAGE_TAG} ${IMAGE_NAME}:test >/dev/null 2>&1 || true"
        }
    }
}
