output "grafana_access" {
  value       = "Access via port-forward: kubectl port-forward -n monitoring svc/kube-prometheus-stack-grafana 3000:80"
  description = "Grafana access command (username: admin)"
}

output "grafana_service_name" {
  value       = "kube-prometheus-stack-grafana"
  description = "Grafana service name in monitoring namespace"
}
