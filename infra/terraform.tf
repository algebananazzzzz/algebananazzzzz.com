terraform {
  required_version = ">= 1.14"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.0"
    }
  }

  # State in R2 (s3 backend). Per-env state key comes from config/<env>.tfbackend;
  # account endpoint + creds are supplied at init time (env vars / -backend-config):
  #   terraform init -backend-config=config/preprod.tfbackend
  backend "s3" {}
}
