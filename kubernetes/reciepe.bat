REM Create Kind cluster
kind create cluster --config kubernetes\kind\kind-cluster-3-nodes.yml

REM Create namespace
kubectl create namespace kubernetes-dashboard

REM Create service accounts
kubectl apply -f kubernetes\kubectl\kubernetes-dashboard-service-account.yml

REM Install helm chart
helm install kubernetes-dashboard kubernetes\helm\kubernetes-dashboard.tgz -n kubernetes-dashboard


echo Find POD_NAME for kubernetes-dashboard pod - kubernetes-dashboard-
echo kubectl -n kubernetes-dashboard port-forward kubernetes-dashboard-? 8443:8443


kubectl describe serviceaccount admin-user -n kubernetes-dashboard

echo kubectl describe secret admin-user-token-5jtg7 -n kubernetes-dashboard

echo kubectl get serviceaccount admin-user -n kubernetes-dashboard -o jsonpath={.secrets[0].name}
echo kubectl get secret admin-user-token-vjnpk -o jsonpath={.data.token}
for 
echo Use the output token: to log into Dashboard

echo https://127.0.0.1:8443/


echo kubectl -n kubernetes-dashboard port-forward kubernetes-dashboard-5bb8b8f8c8-kfnhf 9090:9090
echo http://127.0.0.1:9090/

Cleanup:

kind delete cluster

helm pull kubernetes-dashboard/kubernetes-dashboard