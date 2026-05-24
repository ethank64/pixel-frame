terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

resource "aws_lightsail_instance" "backend" {
  name              = var.instance_name
  availability_zone = var.availability_zone
  blueprint_id      = var.blueprint_id
  bundle_id         = var.bundle_id
  user_data         = file("${path.module}/../scripts/user-data.sh")
}

resource "aws_lightsail_static_ip" "backend" {
  name = var.static_ip_name
}

resource "aws_lightsail_static_ip_attachment" "backend" {
  static_ip_name = aws_lightsail_static_ip.backend.name
  instance_name  = aws_lightsail_instance.backend.name
}

resource "aws_lightsail_instance_public_ports" "backend" {
  instance_name = aws_lightsail_instance.backend.name

  port_info {
    protocol  = "tcp"
    from_port = var.container_port
    to_port   = var.container_port
  }
}
