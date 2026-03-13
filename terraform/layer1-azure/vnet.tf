#---------------------------------------------------------------
# Azure Virtual Network, Subnets, and NAT Gateway
#---------------------------------------------------------------

resource "azurerm_virtual_network" "main" {
  name                = "${local.name}-vnet"
  location            = local.location
  resource_group_name = local.resource_group
  address_space       = [var.vnet_cidr]
  tags                = local.tags
}

# System node pool subnet
resource "azurerm_subnet" "system" {
  name                 = "${local.name}-system-subnet"
  resource_group_name  = local.resource_group
  virtual_network_name = azurerm_virtual_network.main.name
  address_prefixes     = [cidrsubnet(var.vnet_cidr, 8, 0)]
}

# Kata node pool subnet
resource "azurerm_subnet" "kata" {
  name                 = "${local.name}-kata-subnet"
  resource_group_name  = local.resource_group
  virtual_network_name = azurerm_virtual_network.main.name
  address_prefixes     = [cidrsubnet(var.vnet_cidr, 8, 1)]
}

# AKS pods subnet (Azure CNI Overlay uses this for pod IPs)
resource "azurerm_subnet" "pods" {
  name                 = "${local.name}-pods-subnet"
  resource_group_name  = local.resource_group
  virtual_network_name = azurerm_virtual_network.main.name
  address_prefixes     = [cidrsubnet(var.vnet_cidr, 4, 1)]
}

# NAT Gateway for outbound connectivity
resource "azurerm_public_ip" "nat" {
  name                = "${local.name}-nat-pip"
  location            = local.location
  resource_group_name = local.resource_group
  allocation_method   = "Static"
  sku                 = "Standard"
  tags                = local.tags
}

resource "azurerm_nat_gateway" "main" {
  name                    = "${local.name}-natgw"
  location                = local.location
  resource_group_name     = local.resource_group
  sku_name                = "Standard"
  idle_timeout_in_minutes = 10
  tags                    = local.tags
}

resource "azurerm_nat_gateway_public_ip_association" "main" {
  nat_gateway_id       = azurerm_nat_gateway.main.id
  public_ip_address_id = azurerm_public_ip.nat.id
}

# NOTE: system-subnet must NOT have NAT gateway — it hosts the AKS LoadBalancer
# (Standard LB inbound is incompatible with NAT gateway on the same subnet).
# Only kata-subnet needs NAT gateway for outbound.
resource "azurerm_subnet_nat_gateway_association" "kata" {
  subnet_id      = azurerm_subnet.kata.id
  nat_gateway_id = azurerm_nat_gateway.main.id
}

# Network Security Group for AKS subnets
resource "azurerm_network_security_group" "aks" {
  name                = "${local.name}-aks-nsg"
  location            = local.location
  resource_group_name = local.resource_group
  tags                = local.tags

  security_rule {
    name                       = "Allow-HTTP-HTTPS"
    priority                   = 100
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_ranges    = ["80", "443"]
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }
}

resource "azurerm_subnet_network_security_group_association" "system" {
  subnet_id                 = azurerm_subnet.system.id
  network_security_group_id = azurerm_network_security_group.aks.id
}

resource "azurerm_subnet_network_security_group_association" "kata" {
  subnet_id                 = azurerm_subnet.kata.id
  network_security_group_id = azurerm_network_security_group.aks.id
}
