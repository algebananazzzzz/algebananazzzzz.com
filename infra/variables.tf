variable "env" {
  description = "Deployment environment; the leading segment of every resource name."
  type        = string

  validation {
    condition     = contains(["preprod", "prd"], var.env)
    error_message = "env must be either 'preprod' or 'prd'."
  }
}

variable "cloudflare_account_id" {
  description = "Cloudflare account identifier"
  type        = string
}

variable "cloudflare_api_token" {
  description = "Cloudflare API token with Pages, DNS, and R2 permissions"
  type        = string
  sensitive   = true
}

variable "custom_domain" {
  description = "Custom domain for this environment (e.g. beta.algebananazzzzz.com)"
  type        = string
}

variable "production_branch" {
  description = "Git branch that triggers production deployments for this Pages project"
  type        = string
  default     = "main"
}

variable "project_name" {
  description = "Application name used as the custom suffix in {env}-web-pages-{name}"
  type        = string
}

variable "zone_name" {
  description = "Cloudflare DNS zone name"
  type        = string
  default     = "algebananazzzzz.com"
}
