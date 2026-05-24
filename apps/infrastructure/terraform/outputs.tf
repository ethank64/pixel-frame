output "instance_name" {
  value = aws_lightsail_instance.backend.name
}

output "public_ip" {
  value = data.external.static_ip.result.ip_address
}

output "ecr_repository_url" {
  value = aws_ecr_repository.backend.repository_url
}

output "ecr_repository_name" {
  value = aws_ecr_repository.backend.name
}

output "health_url" {
  value = "http://${data.external.static_ip.result.ip_address}:${var.container_port}/"
}

output "websocket_url" {
  value = "ws://${data.external.static_ip.result.ip_address}:${var.container_port}/api/ws/canvas"
}
