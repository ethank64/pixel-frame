variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "availability_zone" {
  type    = string
  default = "us-east-1a"
}

variable "instance_name" {
  type    = string
  default = "pixel-frame-backend"
}

variable "static_ip_name" {
  type    = string
  default = "pixel-frame-backend-ip"
}

variable "blueprint_id" {
  type    = string
  default = "amazon_linux_2023"
}

variable "bundle_id" {
  type    = string
  default = "nano_3_0"
}

variable "container_port" {
  type    = number
  default = 8000
}

variable "ecr_repository_name" {
  type    = string
  default = "pixel-frame-backend"
}

variable "container_name" {
  type    = string
  default = "pixel-frame-backend"
}
