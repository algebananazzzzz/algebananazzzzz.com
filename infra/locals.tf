locals {
  environment        = var.env
  pages_project_name = "${local.environment}-web-pages-${var.project_name}"

  common_tags = {
    Environment = local.environment
    ManagedBy   = "terraform"
    Project     = var.project_name
  }
}
