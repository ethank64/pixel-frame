terraform {
  backend "s3" {
    bucket = "pixel-frame-terraform-state-497449934068"
    key    = "backend/terraform.tfstate"
    region = "us-east-1"
  }
}
