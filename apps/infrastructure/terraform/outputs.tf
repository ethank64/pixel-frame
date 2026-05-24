output "instance_name" {
  value = aws_lightsail_instance.backend.name
}

output "public_ip" {
  value = aws_lightsail_static_ip.backend.ip_address
}

output "health_url" {
  value = "http://${aws_lightsail_static_ip.backend.ip_address}:${var.container_port}/"
}

output "websocket_url" {
  value = "ws://${aws_lightsail_static_ip.backend.ip_address}:${var.container_port}/api/ws/canvas"
}
