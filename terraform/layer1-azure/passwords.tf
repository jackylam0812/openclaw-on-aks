#---------------------------------------------------------------
# Random passwords (generated in layer1, passed to layer2 via outputs)
#---------------------------------------------------------------

resource "random_password" "litellm_db" {
  length  = 32
  special = true
}

resource "random_password" "litellm_db_admin" {
  length  = 32
  special = true
}

