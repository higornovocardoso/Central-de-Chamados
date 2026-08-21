export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      access_profiles: {
        Row: {
          comment: string
          created_at: string
          id: string
          interface: Database["public"]["Enums"]["glpi_interface"]
          is_default: boolean
          is_system: boolean
          name: string
          sort: number
          updated_at: string
        }
        Insert: {
          comment?: string
          created_at?: string
          id?: string
          interface?: Database["public"]["Enums"]["glpi_interface"]
          is_default?: boolean
          is_system?: boolean
          name: string
          sort?: number
          updated_at?: string
        }
        Update: {
          comment?: string
          created_at?: string
          id?: string
          interface?: Database["public"]["Enums"]["glpi_interface"]
          is_default?: boolean
          is_system?: boolean
          name?: string
          sort?: number
          updated_at?: string
        }
        Relationships: []
      }
      appliance_environments: {
        Row: {
          id: string
          name: string
        }
        Insert: {
          id?: string
          name: string
        }
        Update: {
          id?: string
          name?: string
        }
        Relationships: []
      }
      appliance_items: {
        Row: {
          appliance_id: string
          asset_id: string
          id: string
        }
        Insert: {
          appliance_id: string
          asset_id: string
          id?: string
        }
        Update: {
          appliance_id?: string
          asset_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appliance_items_appliance_id_fkey"
            columns: ["appliance_id"]
            isOneToOne: false
            referencedRelation: "appliances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appliance_items_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      appliance_types: {
        Row: {
          id: string
          name: string
        }
        Insert: {
          id?: string
          name: string
        }
        Update: {
          id?: string
          name?: string
        }
        Relationships: []
      }
      appliances: {
        Row: {
          appliance_type_id: string | null
          comment: string
          created_at: string
          entity_id: string
          environment_id: string | null
          group_id: string | null
          id: string
          is_deleted: boolean
          name: string
          technician_id: string | null
          updated_at: string
        }
        Insert: {
          appliance_type_id?: string | null
          comment?: string
          created_at?: string
          entity_id: string
          environment_id?: string | null
          group_id?: string | null
          id?: string
          is_deleted?: boolean
          name: string
          technician_id?: string | null
          updated_at?: string
        }
        Update: {
          appliance_type_id?: string | null
          comment?: string
          created_at?: string
          entity_id?: string
          environment_id?: string | null
          group_id?: string | null
          id?: string
          is_deleted?: boolean
          name?: string
          technician_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appliances_appliance_type_id_fkey"
            columns: ["appliance_type_id"]
            isOneToOne: false
            referencedRelation: "appliance_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appliances_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appliances_environment_id_fkey"
            columns: ["environment_id"]
            isOneToOne: false
            referencedRelation: "appliance_environments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appliances_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "user_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_cables: {
        Row: {
          asset_id: string
          cable_type: string
          color: string
          endpoint_a_id: string | null
          endpoint_b_id: string | null
          length_m: number | null
          socket_a_id: string | null
          socket_b_id: string | null
        }
        Insert: {
          asset_id: string
          cable_type?: string
          color?: string
          endpoint_a_id?: string | null
          endpoint_b_id?: string | null
          length_m?: number | null
          socket_a_id?: string | null
          socket_b_id?: string | null
        }
        Update: {
          asset_id?: string
          cable_type?: string
          color?: string
          endpoint_a_id?: string | null
          endpoint_b_id?: string | null
          length_m?: number | null
          socket_a_id?: string | null
          socket_b_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_cables_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: true
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_cables_endpoint_a_id_fkey"
            columns: ["endpoint_a_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_cables_endpoint_b_id_fkey"
            columns: ["endpoint_b_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_cables_socket_a_id_fkey"
            columns: ["socket_a_id"]
            isOneToOne: false
            referencedRelation: "sockets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_cables_socket_b_id_fkey"
            columns: ["socket_b_id"]
            isOneToOne: false
            referencedRelation: "sockets"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_components: {
        Row: {
          asset_id: string
          component_id: string
          created_at: string
          id: string
          quantity: number
          serial_number: string
          size: string
        }
        Insert: {
          asset_id: string
          component_id: string
          created_at?: string
          id?: string
          quantity?: number
          serial_number?: string
          size?: string
        }
        Update: {
          asset_id?: string
          component_id?: string
          created_at?: string
          id?: string
          quantity?: number
          serial_number?: string
          size?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_components_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_components_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "components"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_computers: {
        Row: {
          antivirus_name: string
          antivirus_updated: boolean
          asset_id: string
          host_asset_id: string | null
          is_virtual: boolean
          last_inventory_at: string | null
          remote_management: string
        }
        Insert: {
          antivirus_name?: string
          antivirus_updated?: boolean
          asset_id: string
          host_asset_id?: string | null
          is_virtual?: boolean
          last_inventory_at?: string | null
          remote_management?: string
        }
        Update: {
          antivirus_name?: string
          antivirus_updated?: boolean
          asset_id?: string
          host_asset_id?: string | null
          is_virtual?: boolean
          last_inventory_at?: string | null
          remote_management?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_computers_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: true
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_computers_host_asset_id_fkey"
            columns: ["host_asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_connections: {
        Row: {
          computer_id: string
          created_at: string
          id: string
          peripheral_id: string
        }
        Insert: {
          computer_id: string
          created_at?: string
          id?: string
          peripheral_id: string
        }
        Update: {
          computer_id?: string
          created_at?: string
          id?: string
          peripheral_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_connections_computer_id_fkey"
            columns: ["computer_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_connections_peripheral_id_fkey"
            columns: ["peripheral_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_enclosures: {
        Row: {
          asset_id: string
          power_supplies: number
          slots: number
        }
        Insert: {
          asset_id: string
          power_supplies?: number
          slots?: number
        }
        Update: {
          asset_id?: string
          power_supplies?: number
          slots?: number
        }
        Relationships: [
          {
            foreignKeyName: "asset_enclosures_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: true
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_infocoms: {
        Row: {
          asset_id: string
          budget_id: string | null
          business_criticity: string
          buy_date: string | null
          comment: string
          created_at: string
          delivery_date: string | null
          delivery_number: string
          depreciation: Database["public"]["Enums"]["depreciation_type"]
          depreciation_coefficient: number
          depreciation_months: number
          id: string
          invoice_number: string
          order_date: string | null
          order_number: string
          supplier_id: string | null
          updated_at: string
          use_date: string | null
          value: number
          warranty_info: string
          warranty_months: number
          warranty_start: string | null
          warranty_value: number
        }
        Insert: {
          asset_id: string
          budget_id?: string | null
          business_criticity?: string
          buy_date?: string | null
          comment?: string
          created_at?: string
          delivery_date?: string | null
          delivery_number?: string
          depreciation?: Database["public"]["Enums"]["depreciation_type"]
          depreciation_coefficient?: number
          depreciation_months?: number
          id?: string
          invoice_number?: string
          order_date?: string | null
          order_number?: string
          supplier_id?: string | null
          updated_at?: string
          use_date?: string | null
          value?: number
          warranty_info?: string
          warranty_months?: number
          warranty_start?: string | null
          warranty_value?: number
        }
        Update: {
          asset_id?: string
          budget_id?: string | null
          business_criticity?: string
          buy_date?: string | null
          comment?: string
          created_at?: string
          delivery_date?: string | null
          delivery_number?: string
          depreciation?: Database["public"]["Enums"]["depreciation_type"]
          depreciation_coefficient?: number
          depreciation_months?: number
          id?: string
          invoice_number?: string
          order_date?: string | null
          order_number?: string
          supplier_id?: string | null
          updated_at?: string
          use_date?: string | null
          value?: number
          warranty_info?: string
          warranty_months?: number
          warranty_start?: string | null
          warranty_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "asset_infocoms_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: true
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_infocoms_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_infocoms_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_models: {
        Row: {
          comment: string
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["asset_kind"]
          manufacturer_id: string | null
          name: string
          product_number: string
        }
        Insert: {
          comment?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["asset_kind"]
          manufacturer_id?: string | null
          name: string
          product_number?: string
        }
        Update: {
          comment?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["asset_kind"]
          manufacturer_id?: string | null
          name?: string
          product_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_models_manufacturer_id_fkey"
            columns: ["manufacturer_id"]
            isOneToOne: false
            referencedRelation: "manufacturers"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_monitors: {
        Row: {
          asset_id: string
          has_displayport: boolean
          has_dvi: boolean
          has_hdmi: boolean
          has_usb: boolean
          has_vga: boolean
          size_inches: number | null
        }
        Insert: {
          asset_id: string
          has_displayport?: boolean
          has_dvi?: boolean
          has_hdmi?: boolean
          has_usb?: boolean
          has_vga?: boolean
          size_inches?: number | null
        }
        Update: {
          asset_id?: string
          has_displayport?: boolean
          has_dvi?: boolean
          has_hdmi?: boolean
          has_usb?: boolean
          has_vga?: boolean
          size_inches?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_monitors_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: true
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_network_equipments: {
        Row: {
          asset_id: string
          firmware: string
          mac: string
          ports_count: number
          ram_size: number | null
        }
        Insert: {
          asset_id: string
          firmware?: string
          mac?: string
          ports_count?: number
          ram_size?: number | null
        }
        Update: {
          asset_id?: string
          firmware?: string
          mac?: string
          ports_count?: number
          ram_size?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_network_equipments_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: true
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_operating_systems: {
        Row: {
          architecture: string
          asset_id: string
          id: string
          installation_date: string | null
          kernel_version: string
          license_number: string
          os_id: string | null
          product_id: string
          service_pack: string
          version: string
        }
        Insert: {
          architecture?: string
          asset_id: string
          id?: string
          installation_date?: string | null
          kernel_version?: string
          license_number?: string
          os_id?: string | null
          product_id?: string
          service_pack?: string
          version?: string
        }
        Update: {
          architecture?: string
          asset_id?: string
          id?: string
          installation_date?: string | null
          kernel_version?: string
          license_number?: string
          os_id?: string | null
          product_id?: string
          service_pack?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_operating_systems_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: true
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_operating_systems_os_id_fkey"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "operating_systems"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_pdus: {
        Row: {
          asset_id: string
          is_managed: boolean
          max_power_w: number | null
          outlets: number
        }
        Insert: {
          asset_id: string
          is_managed?: boolean
          max_power_w?: number | null
          outlets?: number
        }
        Update: {
          asset_id?: string
          is_managed?: boolean
          max_power_w?: number | null
          outlets?: number
        }
        Relationships: [
          {
            foreignKeyName: "asset_pdus_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: true
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_phones: {
        Row: {
          asset_id: string
          extension: string
          has_camera: boolean
          imei: string
          phone_number: string
        }
        Insert: {
          asset_id: string
          extension?: string
          has_camera?: boolean
          imei?: string
          phone_number?: string
        }
        Update: {
          asset_id?: string
          extension?: string
          has_camera?: boolean
          imei?: string
          phone_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_phones_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: true
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_printers: {
        Row: {
          asset_id: string
          counter_updated_at: string | null
          has_ethernet: boolean
          has_parallel: boolean
          has_serial: boolean
          has_usb: boolean
          has_wifi: boolean
          initial_pages: number
          last_pages_counter: number
          memory_size: number | null
        }
        Insert: {
          asset_id: string
          counter_updated_at?: string | null
          has_ethernet?: boolean
          has_parallel?: boolean
          has_serial?: boolean
          has_usb?: boolean
          has_wifi?: boolean
          initial_pages?: number
          last_pages_counter?: number
          memory_size?: number | null
        }
        Update: {
          asset_id?: string
          counter_updated_at?: string | null
          has_ethernet?: boolean
          has_parallel?: boolean
          has_serial?: boolean
          has_usb?: boolean
          has_wifi?: boolean
          initial_pages?: number
          last_pages_counter?: number
          memory_size?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_printers_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: true
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_racks: {
        Row: {
          asset_id: string
          depth_mm: number | null
          max_weight_kg: number | null
          room: string
          server_room_id: string | null
          units: number
          width_mm: number | null
        }
        Insert: {
          asset_id: string
          depth_mm?: number | null
          max_weight_kg?: number | null
          room?: string
          server_room_id?: string | null
          units?: number
          width_mm?: number | null
        }
        Update: {
          asset_id?: string
          depth_mm?: number | null
          max_weight_kg?: number | null
          room?: string
          server_room_id?: string | null
          units?: number
          width_mm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_racks_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: true
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_racks_server_room_id_fkey"
            columns: ["server_room_id"]
            isOneToOne: false
            referencedRelation: "server_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_sims: {
        Row: {
          asset_id: string
          carrier: string
          iccid: string
          msisdn: string
          pin: string
          puk: string
        }
        Insert: {
          asset_id: string
          carrier?: string
          iccid?: string
          msisdn?: string
          pin?: string
          puk?: string
        }
        Update: {
          asset_id?: string
          carrier?: string
          iccid?: string
          msisdn?: string
          pin?: string
          puk?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_sims_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: true
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_states: {
        Row: {
          color: string
          comment: string
          created_at: string
          id: string
          is_visible_inventory: boolean
          name: string
        }
        Insert: {
          color?: string
          comment?: string
          created_at?: string
          id?: string
          is_visible_inventory?: boolean
          name: string
        }
        Update: {
          color?: string
          comment?: string
          created_at?: string
          id?: string
          is_visible_inventory?: boolean
          name?: string
        }
        Relationships: []
      }
      asset_types: {
        Row: {
          comment: string
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["asset_kind"]
          name: string
        }
        Insert: {
          comment?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["asset_kind"]
          name: string
        }
        Update: {
          comment?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["asset_kind"]
          name?: string
        }
        Relationships: []
      }
      asset_volumes: {
        Row: {
          asset_id: string
          device: string
          filesystem: string
          free_mb: number
          id: string
          is_encrypted: boolean
          mount_point: string
          name: string
          total_mb: number
        }
        Insert: {
          asset_id: string
          device?: string
          filesystem?: string
          free_mb?: number
          id?: string
          is_encrypted?: boolean
          mount_point?: string
          name?: string
          total_mb?: number
        }
        Update: {
          asset_id?: string
          device?: string
          filesystem?: string
          free_mb?: number
          id?: string
          is_encrypted?: boolean
          mount_point?: string
          name?: string
          total_mb?: number
        }
        Relationships: [
          {
            foreignKeyName: "asset_volumes_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          alternate_username: string
          alternate_username_number: string
          asset_tag: string
          assigned_name: string
          assigned_to: string | null
          brand: string
          created_at: string
          deleted_at: string | null
          entity_id: string
          group_id: string | null
          id: string
          is_deleted: boolean
          kind: Database["public"]["Enums"]["asset_kind"]
          location_id: string | null
          manufacturer_id: string | null
          model: string
          model_id: string | null
          name: string
          network_id: string | null
          notes: string
          purchase_date: string | null
          serial_number: string
          state_id: string | null
          status: Database["public"]["Enums"]["asset_status"]
          supplier_id: string | null
          technician_id: string | null
          type_id: string | null
          update_source: string
          updated_at: string
          user_group_id: string | null
          uuid_field: string
          warranty_end: string | null
        }
        Insert: {
          alternate_username?: string
          alternate_username_number?: string
          asset_tag?: string
          assigned_name?: string
          assigned_to?: string | null
          brand?: string
          created_at?: string
          deleted_at?: string | null
          entity_id?: string
          group_id?: string | null
          id?: string
          is_deleted?: boolean
          kind?: Database["public"]["Enums"]["asset_kind"]
          location_id?: string | null
          manufacturer_id?: string | null
          model?: string
          model_id?: string | null
          name: string
          network_id?: string | null
          notes?: string
          purchase_date?: string | null
          serial_number?: string
          state_id?: string | null
          status?: Database["public"]["Enums"]["asset_status"]
          supplier_id?: string | null
          technician_id?: string | null
          type_id?: string | null
          update_source?: string
          updated_at?: string
          user_group_id?: string | null
          uuid_field?: string
          warranty_end?: string | null
        }
        Update: {
          alternate_username?: string
          alternate_username_number?: string
          asset_tag?: string
          assigned_name?: string
          assigned_to?: string | null
          brand?: string
          created_at?: string
          deleted_at?: string | null
          entity_id?: string
          group_id?: string | null
          id?: string
          is_deleted?: boolean
          kind?: Database["public"]["Enums"]["asset_kind"]
          location_id?: string | null
          manufacturer_id?: string | null
          model?: string
          model_id?: string | null
          name?: string
          network_id?: string | null
          notes?: string
          purchase_date?: string | null
          serial_number?: string
          state_id?: string | null
          status?: Database["public"]["Enums"]["asset_status"]
          supplier_id?: string | null
          technician_id?: string | null
          type_id?: string | null
          update_source?: string
          updated_at?: string
          user_group_id?: string | null
          uuid_field?: string
          warranty_end?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "user_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_manufacturer_id_fkey"
            columns: ["manufacturer_id"]
            isOneToOne: false
            referencedRelation: "manufacturers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "asset_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_network_id_fkey"
            columns: ["network_id"]
            isOneToOne: false
            referencedRelation: "ip_networks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "asset_states"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "asset_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_user_group_id_fkey"
            columns: ["user_group_id"]
            isOneToOne: false
            referencedRelation: "user_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      automatic_actions: {
        Row: {
          code: string
          created_at: string
          description: string
          frequency_minutes: number
          id: string
          is_active: boolean
          last_result: string
          last_run_at: string | null
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string
          frequency_minutes?: number
          id?: string
          is_active?: boolean
          last_result?: string
          last_run_at?: string | null
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string
          frequency_minutes?: number
          id?: string
          is_active?: boolean
          last_result?: string
          last_run_at?: string | null
          name?: string
        }
        Relationships: []
      }
      budgets: {
        Row: {
          comment: string
          created_at: string
          end_date: string | null
          entity_id: string
          id: string
          is_deleted: boolean
          name: string
          start_date: string | null
          updated_at: string
          value: number
        }
        Insert: {
          comment?: string
          created_at?: string
          end_date?: string | null
          entity_id: string
          id?: string
          is_deleted?: boolean
          name: string
          start_date?: string | null
          updated_at?: string
          value?: number
        }
        Update: {
          comment?: string
          created_at?: string
          end_date?: string | null
          entity_id?: string
          id?: string
          is_deleted?: boolean
          name?: string
          start_date?: string | null
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "budgets_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      business_rules: {
        Row: {
          created_at: string
          description: string
          entity_id: string
          id: string
          is_active: boolean
          is_recursive: boolean
          match_mode: string
          name: string
          run_on_add: boolean
          run_on_update: boolean
          sort: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          entity_id: string
          id?: string
          is_active?: boolean
          is_recursive?: boolean
          match_mode?: string
          name: string
          run_on_add?: boolean
          run_on_update?: boolean
          sort?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          entity_id?: string
          id?: string
          is_active?: boolean
          is_recursive?: boolean
          match_mode?: string
          name?: string
          run_on_add?: boolean
          run_on_update?: boolean
          sort?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_rules_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_holidays: {
        Row: {
          calendar_id: string | null
          end_date: string
          id: string
          is_recurring: boolean
          name: string
          start_date: string
        }
        Insert: {
          calendar_id?: string | null
          end_date: string
          id?: string
          is_recurring?: boolean
          name: string
          start_date: string
        }
        Update: {
          calendar_id?: string | null
          end_date?: string
          id?: string
          is_recurring?: boolean
          name?: string
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_holidays_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "calendars"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_segments: {
        Row: {
          begin_time: string
          calendar_id: string
          end_time: string
          id: string
          weekday: number
        }
        Insert: {
          begin_time: string
          calendar_id: string
          end_time: string
          id?: string
          weekday: number
        }
        Update: {
          begin_time?: string
          calendar_id?: string
          end_time?: string
          id?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "calendar_segments_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "calendars"
            referencedColumns: ["id"]
          },
        ]
      }
      calendars: {
        Row: {
          comment: string
          created_at: string
          entity_id: string
          id: string
          is_default: boolean
          is_recursive: boolean
          name: string
          updated_at: string
        }
        Insert: {
          comment?: string
          created_at?: string
          entity_id: string
          id?: string
          is_default?: boolean
          is_recursive?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          comment?: string
          created_at?: string
          entity_id?: string
          id?: string
          is_default?: boolean
          is_recursive?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendars_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      cartridge_item_models: {
        Row: {
          cartridge_item_id: string
          id: string
          model_id: string
        }
        Insert: {
          cartridge_item_id: string
          id?: string
          model_id: string
        }
        Update: {
          cartridge_item_id?: string
          id?: string
          model_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cartridge_item_models_cartridge_item_id_fkey"
            columns: ["cartridge_item_id"]
            isOneToOne: false
            referencedRelation: "cartridge_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cartridge_item_models_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "asset_models"
            referencedColumns: ["id"]
          },
        ]
      }
      cartridge_items: {
        Row: {
          alarm_threshold: number
          comment: string
          created_at: string
          entity_id: string
          id: string
          manufacturer_id: string | null
          name: string
          reference: string
        }
        Insert: {
          alarm_threshold?: number
          comment?: string
          created_at?: string
          entity_id: string
          id?: string
          manufacturer_id?: string | null
          name: string
          reference?: string
        }
        Update: {
          alarm_threshold?: number
          comment?: string
          created_at?: string
          entity_id?: string
          id?: string
          manufacturer_id?: string | null
          name?: string
          reference?: string
        }
        Relationships: [
          {
            foreignKeyName: "cartridge_items_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cartridge_items_manufacturer_id_fkey"
            columns: ["manufacturer_id"]
            isOneToOne: false
            referencedRelation: "manufacturers"
            referencedColumns: ["id"]
          },
        ]
      }
      cartridges: {
        Row: {
          cartridge_item_id: string
          date_in: string
          date_out: string | null
          date_use: string | null
          id: string
          pages_counter: number
          printer_id: string | null
        }
        Insert: {
          cartridge_item_id: string
          date_in?: string
          date_out?: string | null
          date_use?: string | null
          id?: string
          pages_counter?: number
          printer_id?: string | null
        }
        Update: {
          cartridge_item_id?: string
          date_in?: string
          date_out?: string | null
          date_use?: string | null
          id?: string
          pages_counter?: number
          printer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cartridges_cartridge_item_id_fkey"
            columns: ["cartridge_item_id"]
            isOneToOne: false
            referencedRelation: "cartridge_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cartridges_printer_id_fkey"
            columns: ["printer_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      certificate_items: {
        Row: {
          asset_id: string
          certificate_id: string
          id: string
        }
        Insert: {
          asset_id: string
          certificate_id: string
          id?: string
        }
        Update: {
          asset_id?: string
          certificate_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificate_items_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificate_items_certificate_id_fkey"
            columns: ["certificate_id"]
            isOneToOne: false
            referencedRelation: "certificates"
            referencedColumns: ["id"]
          },
        ]
      }
      certificate_types: {
        Row: {
          id: string
          name: string
        }
        Insert: {
          id?: string
          name: string
        }
        Update: {
          id?: string
          name?: string
        }
        Relationships: []
      }
      certificates: {
        Row: {
          certificate_type_id: string | null
          command_used: string
          comment: string
          created_at: string
          dns_name: string
          dns_suffix: string
          entity_id: string
          expire_date: string | null
          id: string
          is_deleted: boolean
          is_self_signed: boolean
          manufacturer_id: string | null
          name: string
          serial_number: string
          updated_at: string
        }
        Insert: {
          certificate_type_id?: string | null
          command_used?: string
          comment?: string
          created_at?: string
          dns_name?: string
          dns_suffix?: string
          entity_id: string
          expire_date?: string | null
          id?: string
          is_deleted?: boolean
          is_self_signed?: boolean
          manufacturer_id?: string | null
          name: string
          serial_number?: string
          updated_at?: string
        }
        Update: {
          certificate_type_id?: string | null
          command_used?: string
          comment?: string
          created_at?: string
          dns_name?: string
          dns_suffix?: string
          entity_id?: string
          expire_date?: string | null
          id?: string
          is_deleted?: boolean
          is_self_signed?: boolean
          manufacturer_id?: string | null
          name?: string
          serial_number?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificates_certificate_type_id_fkey"
            columns: ["certificate_type_id"]
            isOneToOne: false
            referencedRelation: "certificate_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_manufacturer_id_fkey"
            columns: ["manufacturer_id"]
            isOneToOne: false
            referencedRelation: "manufacturers"
            referencedColumns: ["id"]
          },
        ]
      }
      changes: {
        Row: {
          assignee_id: string | null
          backup_plan: string
          category_id: string | null
          checklist: string
          closed_at: string | null
          control_list: string
          created_at: string
          deployment_plan: string
          description: string
          entity_id: string
          id: string
          impact: number
          impacts: string
          is_deleted: boolean
          planned_end: string | null
          planned_start: string | null
          priority_level: number
          requester_id: string | null
          resolved_at: string | null
          solution: string
          status: Database["public"]["Enums"]["change_status"]
          title: string
          updated_at: string
          urgency: number
          validation_state: Database["public"]["Enums"]["validation_state"]
        }
        Insert: {
          assignee_id?: string | null
          backup_plan?: string
          category_id?: string | null
          checklist?: string
          closed_at?: string | null
          control_list?: string
          created_at?: string
          deployment_plan?: string
          description?: string
          entity_id: string
          id?: string
          impact?: number
          impacts?: string
          is_deleted?: boolean
          planned_end?: string | null
          planned_start?: string | null
          priority_level?: number
          requester_id?: string | null
          resolved_at?: string | null
          solution?: string
          status?: Database["public"]["Enums"]["change_status"]
          title: string
          updated_at?: string
          urgency?: number
          validation_state?: Database["public"]["Enums"]["validation_state"]
        }
        Update: {
          assignee_id?: string | null
          backup_plan?: string
          category_id?: string | null
          checklist?: string
          closed_at?: string | null
          control_list?: string
          created_at?: string
          deployment_plan?: string
          description?: string
          entity_id?: string
          id?: string
          impact?: number
          impacts?: string
          is_deleted?: boolean
          planned_end?: string | null
          planned_start?: string | null
          priority_level?: number
          requester_id?: string | null
          resolved_at?: string | null
          solution?: string
          status?: Database["public"]["Enums"]["change_status"]
          title?: string
          updated_at?: string
          urgency?: number
          validation_state?: Database["public"]["Enums"]["validation_state"]
        }
        Relationships: [
          {
            foreignKeyName: "changes_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "itil_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "changes_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      cluster_items: {
        Row: {
          asset_id: string
          cluster_id: string
          id: string
        }
        Insert: {
          asset_id: string
          cluster_id: string
          id?: string
        }
        Update: {
          asset_id?: string
          cluster_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cluster_items_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cluster_items_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "clusters"
            referencedColumns: ["id"]
          },
        ]
      }
      clusters: {
        Row: {
          cluster_type: string
          cluster_uuid: string
          comment: string
          created_at: string
          entity_id: string
          id: string
          name: string
          version: string
        }
        Insert: {
          cluster_type?: string
          cluster_uuid?: string
          comment?: string
          created_at?: string
          entity_id: string
          id?: string
          name: string
          version?: string
        }
        Update: {
          cluster_type?: string
          cluster_uuid?: string
          comment?: string
          created_at?: string
          entity_id?: string
          id?: string
          name?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "clusters_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      collector_blacklist: {
        Row: {
          comment: string
          id: string
          kind: string
          value: string
        }
        Insert: {
          comment?: string
          id?: string
          kind?: string
          value: string
        }
        Update: {
          comment?: string
          id?: string
          kind?: string
          value?: string
        }
        Relationships: []
      }
      components: {
        Row: {
          comment: string
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["component_kind"]
          manufacturer_id: string | null
          name: string
          specification: string
        }
        Insert: {
          comment?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["component_kind"]
          manufacturer_id?: string | null
          name: string
          specification?: string
        }
        Update: {
          comment?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["component_kind"]
          manufacturer_id?: string | null
          name?: string
          specification?: string
        }
        Relationships: [
          {
            foreignKeyName: "components_manufacturer_id_fkey"
            columns: ["manufacturer_id"]
            isOneToOne: false
            referencedRelation: "manufacturers"
            referencedColumns: ["id"]
          },
        ]
      }
      consumable_items: {
        Row: {
          alarm_threshold: number
          comment: string
          created_at: string
          entity_id: string
          id: string
          manufacturer_id: string | null
          name: string
          reference: string
        }
        Insert: {
          alarm_threshold?: number
          comment?: string
          created_at?: string
          entity_id: string
          id?: string
          manufacturer_id?: string | null
          name: string
          reference?: string
        }
        Update: {
          alarm_threshold?: number
          comment?: string
          created_at?: string
          entity_id?: string
          id?: string
          manufacturer_id?: string | null
          name?: string
          reference?: string
        }
        Relationships: [
          {
            foreignKeyName: "consumable_items_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consumable_items_manufacturer_id_fkey"
            columns: ["manufacturer_id"]
            isOneToOne: false
            referencedRelation: "manufacturers"
            referencedColumns: ["id"]
          },
        ]
      }
      consumables: {
        Row: {
          assigned_to: string | null
          consumable_item_id: string
          date_in: string
          date_out: string | null
          id: string
        }
        Insert: {
          assigned_to?: string | null
          consumable_item_id: string
          date_in?: string
          date_out?: string | null
          id?: string
        }
        Update: {
          assigned_to?: string | null
          consumable_item_id?: string
          date_in?: string
          date_out?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consumables_consumable_item_id_fkey"
            columns: ["consumable_item_id"]
            isOneToOne: false
            referencedRelation: "consumable_items"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_suppliers: {
        Row: {
          contact_id: string
          id: string
          supplier_id: string
        }
        Insert: {
          contact_id: string
          id?: string
          supplier_id: string
        }
        Update: {
          contact_id?: string
          id?: string
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_suppliers_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_suppliers_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_types: {
        Row: {
          id: string
          name: string
        }
        Insert: {
          id?: string
          name: string
        }
        Update: {
          id?: string
          name?: string
        }
        Relationships: []
      }
      contacts: {
        Row: {
          address: string
          city: string
          comment: string
          contact_type_id: string | null
          created_at: string
          email: string
          entity_id: string
          fax: string
          first_name: string
          id: string
          is_deleted: boolean
          mobile: string
          name: string
          phone: string
          phone2: string
          title: string
          updated_at: string
        }
        Insert: {
          address?: string
          city?: string
          comment?: string
          contact_type_id?: string | null
          created_at?: string
          email?: string
          entity_id: string
          fax?: string
          first_name?: string
          id?: string
          is_deleted?: boolean
          mobile?: string
          name: string
          phone?: string
          phone2?: string
          title?: string
          updated_at?: string
        }
        Update: {
          address?: string
          city?: string
          comment?: string
          contact_type_id?: string | null
          created_at?: string
          email?: string
          entity_id?: string
          fax?: string
          first_name?: string
          id?: string
          is_deleted?: boolean
          mobile?: string
          name?: string
          phone?: string
          phone2?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_contact_type_id_fkey"
            columns: ["contact_type_id"]
            isOneToOne: false
            referencedRelation: "contact_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_costs: {
        Row: {
          begin_date: string | null
          budget_id: string | null
          comment: string
          contract_id: string
          end_date: string | null
          id: string
          name: string
          value: number
        }
        Insert: {
          begin_date?: string | null
          budget_id?: string | null
          comment?: string
          contract_id: string
          end_date?: string | null
          id?: string
          name?: string
          value?: number
        }
        Update: {
          begin_date?: string | null
          budget_id?: string | null
          comment?: string
          contract_id?: string
          end_date?: string | null
          id?: string
          name?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "contract_costs_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_costs_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_items: {
        Row: {
          asset_id: string | null
          contract_id: string
          created_at: string
          id: string
        }
        Insert: {
          asset_id?: string | null
          contract_id: string
          created_at?: string
          id?: string
        }
        Update: {
          asset_id?: string | null
          contract_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_items_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_items_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_suppliers: {
        Row: {
          contract_id: string
          id: string
          supplier_id: string
        }
        Insert: {
          contract_id: string
          id?: string
          supplier_id: string
        }
        Update: {
          contract_id?: string
          id?: string
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_suppliers_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_suppliers_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_types: {
        Row: {
          id: string
          name: string
        }
        Insert: {
          id?: string
          name: string
        }
        Update: {
          id?: string
          name?: string
        }
        Relationships: []
      }
      contracts: {
        Row: {
          account_number: string
          alert_days: number
          budget_id: string | null
          comment: string
          contract_type_id: string | null
          created_at: string
          entity_id: string
          id: string
          initial_months: number
          invoice_period_months: number
          is_deleted: boolean
          max_hours: number
          name: string
          notice_months: number
          number: string
          renewal: Database["public"]["Enums"]["renewal_kind"]
          renewal_months: number
          start_date: string | null
          updated_at: string
          value: number
        }
        Insert: {
          account_number?: string
          alert_days?: number
          budget_id?: string | null
          comment?: string
          contract_type_id?: string | null
          created_at?: string
          entity_id: string
          id?: string
          initial_months?: number
          invoice_period_months?: number
          is_deleted?: boolean
          max_hours?: number
          name: string
          notice_months?: number
          number?: string
          renewal?: Database["public"]["Enums"]["renewal_kind"]
          renewal_months?: number
          start_date?: string | null
          updated_at?: string
          value?: number
        }
        Update: {
          account_number?: string
          alert_days?: number
          budget_id?: string | null
          comment?: string
          contract_type_id?: string | null
          created_at?: string
          entity_id?: string
          id?: string
          initial_months?: number
          invoice_period_months?: number
          is_deleted?: boolean
          max_hours?: number
          name?: string
          notice_months?: number
          number?: string
          renewal?: Database["public"]["Enums"]["renewal_kind"]
          renewal_months?: number
          start_date?: string | null
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "contracts_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_contract_type_id_fkey"
            columns: ["contract_type_id"]
            isOneToOne: false
            referencedRelation: "contract_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboards: {
        Row: {
          created_at: string
          entity_id: string | null
          id: string
          is_default: boolean
          is_public: boolean
          name: string
          updated_at: string
          user_id: string | null
          widgets: Json
        }
        Insert: {
          created_at?: string
          entity_id?: string | null
          id?: string
          is_default?: boolean
          is_public?: boolean
          name: string
          updated_at?: string
          user_id?: string | null
          widgets?: Json
        }
        Update: {
          created_at?: string
          entity_id?: string | null
          id?: string
          is_default?: boolean
          is_public?: boolean
          name?: string
          updated_at?: string
          user_id?: string | null
          widgets?: Json
        }
        Relationships: [
          {
            foreignKeyName: "dashboards_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      database_instances: {
        Row: {
          asset_id: string | null
          comment: string
          created_at: string
          entity_id: string
          id: string
          install_path: string
          is_active: boolean
          name: string
          port: number | null
          version: string
        }
        Insert: {
          asset_id?: string | null
          comment?: string
          created_at?: string
          entity_id: string
          id?: string
          install_path?: string
          is_active?: boolean
          name: string
          port?: number | null
          version?: string
        }
        Update: {
          asset_id?: string | null
          comment?: string
          created_at?: string
          entity_id?: string
          id?: string
          install_path?: string
          is_active?: boolean
          name?: string
          port?: number | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "database_instances_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "database_instances_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      databases: {
        Row: {
          comment: string
          id: string
          instance_id: string
          is_active: boolean
          is_on_backup: boolean
          name: string
          size_mb: number
        }
        Insert: {
          comment?: string
          id?: string
          instance_id: string
          is_active?: boolean
          is_on_backup?: boolean
          name: string
          size_mb?: number
        }
        Update: {
          comment?: string
          id?: string
          instance_id?: string
          is_active?: boolean
          is_on_backup?: boolean
          name?: string
          size_mb?: number
        }
        Relationships: [
          {
            foreignKeyName: "databases_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "database_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      datacenters: {
        Row: {
          comment: string
          created_at: string
          entity_id: string
          id: string
          location_id: string | null
          name: string
        }
        Insert: {
          comment?: string
          created_at?: string
          entity_id: string
          id?: string
          location_id?: string | null
          name: string
        }
        Update: {
          comment?: string
          created_at?: string
          entity_id?: string
          id?: string
          location_id?: string | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "datacenters_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "datacenters_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      dictionaries: {
        Row: {
          comment: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          target: string
        }
        Insert: {
          comment?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          target: string
        }
        Update: {
          comment?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          target?: string
        }
        Relationships: []
      }
      dictionary_entries: {
        Row: {
          dictionary_id: string
          id: string
          is_active: boolean
          is_regex: boolean
          match_value: string
          replace_value: string
          sort: number
        }
        Insert: {
          dictionary_id: string
          id?: string
          is_active?: boolean
          is_regex?: boolean
          match_value: string
          replace_value: string
          sort?: number
        }
        Update: {
          dictionary_id?: string
          id?: string
          is_active?: boolean
          is_regex?: boolean
          match_value?: string
          replace_value?: string
          sort?: number
        }
        Relationships: [
          {
            foreignKeyName: "dictionary_entries_dictionary_id_fkey"
            columns: ["dictionary_id"]
            isOneToOne: false
            referencedRelation: "dictionaries"
            referencedColumns: ["id"]
          },
        ]
      }
      document_headings: {
        Row: {
          id: string
          name: string
        }
        Insert: {
          id?: string
          name: string
        }
        Update: {
          id?: string
          name?: string
        }
        Relationships: []
      }
      document_items: {
        Row: {
          created_at: string
          document_id: string
          id: string
          item_id: string
          item_type: string
        }
        Insert: {
          created_at?: string
          document_id: string
          id?: string
          item_id: string
          item_type: string
        }
        Update: {
          created_at?: string
          document_id?: string
          id?: string
          item_id?: string
          item_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_items_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_tickets: {
        Row: {
          document_id: string
          id: string
          ticket_id: string
        }
        Insert: {
          document_id: string
          id?: string
          ticket_id: string
        }
        Update: {
          document_id?: string
          id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_tickets_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_tickets_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          entity_id: string
          filename: string
          heading_id: string | null
          id: string
          is_deleted: boolean
          mime_type: string
          name: string
          size_bytes: number
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          entity_id: string
          filename?: string
          heading_id?: string | null
          id?: string
          is_deleted?: boolean
          mime_type?: string
          name: string
          size_bytes?: number
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          entity_id?: string
          filename?: string
          heading_id?: string | null
          id?: string
          is_deleted?: boolean
          mime_type?: string
          name?: string
          size_bytes?: number
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_heading_id_fkey"
            columns: ["heading_id"]
            isOneToOne: false
            referencedRelation: "document_headings"
            referencedColumns: ["id"]
          },
        ]
      }
      domain_items: {
        Row: {
          asset_id: string
          domain_id: string
          id: string
        }
        Insert: {
          asset_id: string
          domain_id: string
          id?: string
        }
        Update: {
          asset_id?: string
          domain_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "domain_items_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "domain_items_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "domains"
            referencedColumns: ["id"]
          },
        ]
      }
      domain_record_types: {
        Row: {
          id: string
          name: string
        }
        Insert: {
          id?: string
          name: string
        }
        Update: {
          id?: string
          name?: string
        }
        Relationships: []
      }
      domain_records: {
        Row: {
          comment: string
          data: string
          domain_id: string
          id: string
          name: string
          record_type_id: string | null
          ttl: number
        }
        Insert: {
          comment?: string
          data?: string
          domain_id: string
          id?: string
          name: string
          record_type_id?: string | null
          ttl?: number
        }
        Update: {
          comment?: string
          data?: string
          domain_id?: string
          id?: string
          name?: string
          record_type_id?: string | null
          ttl?: number
        }
        Relationships: [
          {
            foreignKeyName: "domain_records_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "domain_records_record_type_id_fkey"
            columns: ["record_type_id"]
            isOneToOne: false
            referencedRelation: "domain_record_types"
            referencedColumns: ["id"]
          },
        ]
      }
      domain_types: {
        Row: {
          id: string
          name: string
        }
        Insert: {
          id?: string
          name: string
        }
        Update: {
          id?: string
          name?: string
        }
        Relationships: []
      }
      domains: {
        Row: {
          comment: string
          created_at: string
          domain_type_id: string | null
          entity_id: string
          expire_date: string | null
          id: string
          is_deleted: boolean
          name: string
          registration_date: string | null
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          comment?: string
          created_at?: string
          domain_type_id?: string | null
          entity_id: string
          expire_date?: string | null
          id?: string
          is_deleted?: boolean
          name: string
          registration_date?: string | null
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          comment?: string
          created_at?: string
          domain_type_id?: string | null
          entity_id?: string
          expire_date?: string | null
          id?: string
          is_deleted?: boolean
          name?: string
          registration_date?: string | null
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "domains_domain_type_id_fkey"
            columns: ["domain_type_id"]
            isOneToOne: false
            referencedRelation: "domain_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "domains_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "domains_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      entities: {
        Row: {
          address: string
          admin_email: string
          admin_name: string
          administrative_number: string
          auto_assign_mode: string
          auto_close_days: number
          auto_purge_days: number
          calendar_id: string | null
          city: string
          comment: string
          country: string
          created_at: string
          default_ticket_type: Database["public"]["Enums"]["ticket_type"]
          email: string
          email_signature: string
          fax: string
          id: string
          level: number
          name: string
          notification_prefix: string
          notifications_enabled: boolean
          parent_id: string | null
          path: string
          phone: string
          postal_code: string
          reply_to: string
          sender_email: string
          sender_name: string
          state: string
          survey_comment_below: number
          survey_delay_days: number
          survey_enabled: boolean
          survey_max_score: number
          survey_rate: number
          updated_at: string
          website: string
        }
        Insert: {
          address?: string
          admin_email?: string
          admin_name?: string
          administrative_number?: string
          auto_assign_mode?: string
          auto_close_days?: number
          auto_purge_days?: number
          calendar_id?: string | null
          city?: string
          comment?: string
          country?: string
          created_at?: string
          default_ticket_type?: Database["public"]["Enums"]["ticket_type"]
          email?: string
          email_signature?: string
          fax?: string
          id?: string
          level?: number
          name: string
          notification_prefix?: string
          notifications_enabled?: boolean
          parent_id?: string | null
          path?: string
          phone?: string
          postal_code?: string
          reply_to?: string
          sender_email?: string
          sender_name?: string
          state?: string
          survey_comment_below?: number
          survey_delay_days?: number
          survey_enabled?: boolean
          survey_max_score?: number
          survey_rate?: number
          updated_at?: string
          website?: string
        }
        Update: {
          address?: string
          admin_email?: string
          admin_name?: string
          administrative_number?: string
          auto_assign_mode?: string
          auto_close_days?: number
          auto_purge_days?: number
          calendar_id?: string | null
          city?: string
          comment?: string
          country?: string
          created_at?: string
          default_ticket_type?: Database["public"]["Enums"]["ticket_type"]
          email?: string
          email_signature?: string
          fax?: string
          id?: string
          level?: number
          name?: string
          notification_prefix?: string
          notifications_enabled?: boolean
          parent_id?: string | null
          path?: string
          phone?: string
          postal_code?: string
          reply_to?: string
          sender_email?: string
          sender_name?: string
          state?: string
          survey_comment_below?: number
          survey_delay_days?: number
          survey_enabled?: boolean
          survey_max_score?: number
          survey_rate?: number
          updated_at?: string
          website?: string
        }
        Relationships: [
          {
            foreignKeyName: "entities_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "calendars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entities_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      escalation_actions: {
        Row: {
          action_type: string
          field: string
          id: string
          level_id: string
          value: string
        }
        Insert: {
          action_type: string
          field?: string
          id?: string
          level_id: string
          value?: string
        }
        Update: {
          action_type?: string
          field?: string
          id?: string
          level_id?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "escalation_actions_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "escalation_levels"
            referencedColumns: ["id"]
          },
        ]
      }
      escalation_criteria: {
        Row: {
          field: string
          id: string
          level_id: string
          operator: string
          value: string
        }
        Insert: {
          field: string
          id?: string
          level_id: string
          operator?: string
          value?: string
        }
        Update: {
          field?: string
          id?: string
          level_id?: string
          operator?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "escalation_criteria_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "escalation_levels"
            referencedColumns: ["id"]
          },
        ]
      }
      escalation_levels: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          offset_minutes: number
          service_level_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          offset_minutes?: number
          service_level_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          offset_minutes?: number
          service_level_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "escalation_levels_service_level_id_fkey"
            columns: ["service_level_id"]
            isOneToOne: false
            referencedRelation: "service_levels"
            referencedColumns: ["id"]
          },
        ]
      }
      escalation_log: {
        Row: {
          executed_at: string
          id: string
          level_id: string
          ticket_id: string
        }
        Insert: {
          executed_at?: string
          id?: string
          level_id: string
          ticket_id: string
        }
        Update: {
          executed_at?: string
          id?: string
          level_id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "escalation_log_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "escalation_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalation_log_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      field_locks: {
        Row: {
          created_at: string
          field: string
          id: string
          item_id: string
          item_type: string
          locked_by: string | null
        }
        Insert: {
          created_at?: string
          field: string
          id?: string
          item_id: string
          item_type?: string
          locked_by?: string | null
        }
        Update: {
          created_at?: string
          field?: string
          id?: string
          item_id?: string
          item_type?: string
          locked_by?: string | null
        }
        Relationships: []
      }
      field_unicity: {
        Row: {
          action: string
          comment: string
          created_at: string
          fields: string[]
          id: string
          is_active: boolean
          item_type: string
          name: string
        }
        Insert: {
          action?: string
          comment?: string
          created_at?: string
          fields?: string[]
          id?: string
          is_active?: boolean
          item_type?: string
          name: string
        }
        Update: {
          action?: string
          comment?: string
          created_at?: string
          fields?: string[]
          id?: string
          is_active?: boolean
          item_type?: string
          name?: string
        }
        Relationships: []
      }
      flag_definitions: {
        Row: {
          category: string
          key: string
          label: string
          sort: number
        }
        Insert: {
          category: string
          key: string
          label: string
          sort?: number
        }
        Update: {
          category?: string
          key?: string
          label?: string
          sort?: number
        }
        Relationships: []
      }
      group_members: {
        Row: {
          group_id: string
          id: string
          is_delegate: boolean
          is_manager: boolean
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          is_delegate?: boolean
          is_manager?: boolean
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          is_delegate?: boolean
          is_manager?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "user_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      ip_addresses: {
        Row: {
          address: string
          id: string
          network_id: string | null
          port_id: string
          version: number
        }
        Insert: {
          address: string
          id?: string
          network_id?: string | null
          port_id: string
          version?: number
        }
        Update: {
          address?: string
          id?: string
          network_id?: string | null
          port_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "ip_addresses_network_id_fkey"
            columns: ["network_id"]
            isOneToOne: false
            referencedRelation: "ip_networks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ip_addresses_port_id_fkey"
            columns: ["port_id"]
            isOneToOne: false
            referencedRelation: "network_ports"
            referencedColumns: ["id"]
          },
        ]
      }
      ip_networks: {
        Row: {
          address: string
          comment: string
          entity_id: string
          gateway: string
          id: string
          name: string
          netmask: string
          vlan_id: string | null
        }
        Insert: {
          address?: string
          comment?: string
          entity_id: string
          gateway?: string
          id?: string
          name: string
          netmask?: string
          vlan_id?: string | null
        }
        Update: {
          address?: string
          comment?: string
          entity_id?: string
          gateway?: string
          id?: string
          name?: string
          netmask?: string
          vlan_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ip_networks_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ip_networks_vlan_id_fkey"
            columns: ["vlan_id"]
            isOneToOne: false
            referencedRelation: "vlans"
            referencedColumns: ["id"]
          },
        ]
      }
      item_history: {
        Row: {
          created_at: string
          field: string
          id: string
          item_id: string
          item_type: string
          new_value: string
          old_value: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          field: string
          id?: string
          item_id: string
          item_type: string
          new_value?: string
          old_value?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          field?: string
          id?: string
          item_id?: string
          item_type?: string
          new_value?: string
          old_value?: string
          user_id?: string | null
        }
        Relationships: []
      }
      itil_assets: {
        Row: {
          asset_id: string
          id: string
          item_id: string
          item_type: string
        }
        Insert: {
          asset_id: string
          id?: string
          item_id: string
          item_type: string
        }
        Update: {
          asset_id?: string
          id?: string
          item_id?: string
          item_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "itil_assets_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      itil_categories: {
        Row: {
          comment: string
          created_at: string
          entity_id: string
          group_id: string | null
          id: string
          is_recursive: boolean
          kb_category: string
          level: number
          name: string
          parent_id: string | null
          path: string
          technician_id: string | null
          updated_at: string
          visible_change: boolean
          visible_helpdesk: boolean
          visible_incident: boolean
          visible_problem: boolean
          visible_request: boolean
        }
        Insert: {
          comment?: string
          created_at?: string
          entity_id: string
          group_id?: string | null
          id?: string
          is_recursive?: boolean
          kb_category?: string
          level?: number
          name: string
          parent_id?: string | null
          path?: string
          technician_id?: string | null
          updated_at?: string
          visible_change?: boolean
          visible_helpdesk?: boolean
          visible_incident?: boolean
          visible_problem?: boolean
          visible_request?: boolean
        }
        Update: {
          comment?: string
          created_at?: string
          entity_id?: string
          group_id?: string | null
          id?: string
          is_recursive?: boolean
          kb_category?: string
          level?: number
          name?: string
          parent_id?: string | null
          path?: string
          technician_id?: string | null
          updated_at?: string
          visible_change?: boolean
          visible_helpdesk?: boolean
          visible_incident?: boolean
          visible_problem?: boolean
          visible_request?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "itil_categories_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itil_categories_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "user_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itil_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "itil_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      itil_costs: {
        Row: {
          budget_id: string | null
          cost_fixed: number
          cost_material: number
          cost_time: number
          created_at: string
          duration_minutes: number
          id: string
          item_id: string
          item_type: string
          name: string
        }
        Insert: {
          budget_id?: string | null
          cost_fixed?: number
          cost_material?: number
          cost_time?: number
          created_at?: string
          duration_minutes?: number
          id?: string
          item_id: string
          item_type: string
          name?: string
        }
        Update: {
          budget_id?: string | null
          cost_fixed?: number
          cost_material?: number
          cost_time?: number
          created_at?: string
          duration_minutes?: number
          id?: string
          item_id?: string
          item_type?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "itil_costs_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
        ]
      }
      itil_followups: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          id: string
          is_private: boolean
          item_id: string
          item_type: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          id?: string
          is_private?: boolean
          item_id: string
          item_type: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          is_private?: boolean
          item_id?: string
          item_type?: string
        }
        Relationships: []
      }
      itil_relations: {
        Row: {
          created_at: string
          id: string
          link_type: Database["public"]["Enums"]["ticket_link_type"]
          source_id: string
          source_type: string
          target_id: string
          target_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          link_type?: Database["public"]["Enums"]["ticket_link_type"]
          source_id: string
          source_type: string
          target_id: string
          target_type: string
        }
        Update: {
          created_at?: string
          id?: string
          link_type?: Database["public"]["Enums"]["ticket_link_type"]
          source_id?: string
          source_type?: string
          target_id?: string
          target_type?: string
        }
        Relationships: []
      }
      itil_tasks: {
        Row: {
          assigned_user_id: string | null
          author_id: string | null
          category_id: string | null
          content: string
          created_at: string
          duration_minutes: number
          id: string
          is_private: boolean
          item_id: string
          item_type: string
          planned_start: string | null
          state: Database["public"]["Enums"]["task_state"]
        }
        Insert: {
          assigned_user_id?: string | null
          author_id?: string | null
          category_id?: string | null
          content?: string
          created_at?: string
          duration_minutes?: number
          id?: string
          is_private?: boolean
          item_id: string
          item_type: string
          planned_start?: string | null
          state?: Database["public"]["Enums"]["task_state"]
        }
        Update: {
          assigned_user_id?: string | null
          author_id?: string | null
          category_id?: string | null
          content?: string
          created_at?: string
          duration_minutes?: number
          id?: string
          is_private?: boolean
          item_id?: string
          item_type?: string
          planned_start?: string | null
          state?: Database["public"]["Enums"]["task_state"]
        }
        Relationships: [
          {
            foreignKeyName: "itil_tasks_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "task_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_articles: {
        Row: {
          author_id: string | null
          body: string
          category: string
          created_at: string
          entity_id: string
          id: string
          is_deleted: boolean
          is_faq: boolean
          kb_category_id: string | null
          published: boolean
          summary: string
          title: string
          updated_at: string
          view_counter: number
        }
        Insert: {
          author_id?: string | null
          body?: string
          category?: string
          created_at?: string
          entity_id?: string
          id?: string
          is_deleted?: boolean
          is_faq?: boolean
          kb_category_id?: string | null
          published?: boolean
          summary?: string
          title: string
          updated_at?: string
          view_counter?: number
        }
        Update: {
          author_id?: string | null
          body?: string
          category?: string
          created_at?: string
          entity_id?: string
          id?: string
          is_deleted?: boolean
          is_faq?: boolean
          kb_category_id?: string | null
          published?: boolean
          summary?: string
          title?: string
          updated_at?: string
          view_counter?: number
        }
        Relationships: [
          {
            foreignKeyName: "kb_articles_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_articles_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_articles_kb_category_id_fkey"
            columns: ["kb_category_id"]
            isOneToOne: false
            referencedRelation: "kb_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_categories: {
        Row: {
          comment: string
          created_at: string
          entity_id: string
          id: string
          level: number
          name: string
          parent_id: string | null
          path: string
        }
        Insert: {
          comment?: string
          created_at?: string
          entity_id: string
          id?: string
          level?: number
          name: string
          parent_id?: string | null
          path?: string
        }
        Update: {
          comment?: string
          created_at?: string
          entity_id?: string
          id?: string
          level?: number
          name?: string
          parent_id?: string | null
          path?: string
        }
        Relationships: [
          {
            foreignKeyName: "kb_categories_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "kb_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_comments: {
        Row: {
          article_id: string
          author_id: string | null
          body: string
          created_at: string
          id: string
          parent_id: string | null
        }
        Insert: {
          article_id: string
          author_id?: string | null
          body: string
          created_at?: string
          id?: string
          parent_id?: string | null
        }
        Update: {
          article_id?: string
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kb_comments_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "kb_articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "kb_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_revisions: {
        Row: {
          article_id: string
          author_id: string | null
          body: string
          created_at: string
          id: string
          revision: number
          title: string
        }
        Insert: {
          article_id: string
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          revision?: number
          title?: string
        }
        Update: {
          article_id?: string
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          revision?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "kb_revisions_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "kb_articles"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_targets: {
        Row: {
          article_id: string
          entity_id: string | null
          group_id: string | null
          id: string
          profile_id: string | null
          user_id: string | null
        }
        Insert: {
          article_id: string
          entity_id?: string | null
          group_id?: string | null
          id?: string
          profile_id?: string | null
          user_id?: string | null
        }
        Update: {
          article_id?: string
          entity_id?: string | null
          group_id?: string | null
          id?: string
          profile_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kb_targets_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "kb_articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_targets_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_targets_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "user_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_targets_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "access_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      line_items: {
        Row: {
          asset_id: string
          id: string
          line_id: string
        }
        Insert: {
          asset_id: string
          id?: string
          line_id: string
        }
        Update: {
          asset_id?: string
          id?: string
          line_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "line_items_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "line_items_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "phone_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      line_types: {
        Row: {
          id: string
          name: string
        }
        Insert: {
          id?: string
          name: string
        }
        Update: {
          id?: string
          name?: string
        }
        Relationships: []
      }
      locations: {
        Row: {
          building: string
          created_at: string
          entity_id: string
          id: string
          name: string
          notes: string
          updated_at: string
        }
        Insert: {
          building?: string
          created_at?: string
          entity_id?: string
          id?: string
          name: string
          notes?: string
          updated_at?: string
        }
        Update: {
          building?: string
          created_at?: string
          entity_id?: string
          id?: string
          name?: string
          notes?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      mail_collectors: {
        Row: {
          comment: string
          created_at: string
          default_category_id: string | null
          default_source_id: string | null
          default_type: Database["public"]["Enums"]["ticket_type"]
          entity_id: string
          id: string
          inbound_address: string
          is_active: boolean
          last_run_at: string | null
          name: string
          secret_token: string
        }
        Insert: {
          comment?: string
          created_at?: string
          default_category_id?: string | null
          default_source_id?: string | null
          default_type?: Database["public"]["Enums"]["ticket_type"]
          entity_id: string
          id?: string
          inbound_address?: string
          is_active?: boolean
          last_run_at?: string | null
          name: string
          secret_token?: string
        }
        Update: {
          comment?: string
          created_at?: string
          default_category_id?: string | null
          default_source_id?: string | null
          default_type?: Database["public"]["Enums"]["ticket_type"]
          entity_id?: string
          id?: string
          inbound_address?: string
          is_active?: boolean
          last_run_at?: string | null
          name?: string
          secret_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "mail_collectors_default_category_id_fkey"
            columns: ["default_category_id"]
            isOneToOne: false
            referencedRelation: "itil_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mail_collectors_default_source_id_fkey"
            columns: ["default_source_id"]
            isOneToOne: false
            referencedRelation: "request_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mail_collectors_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      manufacturers: {
        Row: {
          comment: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          comment?: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          comment?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      network_ports: {
        Row: {
          asset_id: string
          comment: string
          created_at: string
          id: string
          mac: string
          name: string
          network_name: string
          port_number: number | null
          port_type: Database["public"]["Enums"]["network_port_type"]
          socket_id: string | null
          speed: number | null
          vlan_id: string | null
        }
        Insert: {
          asset_id: string
          comment?: string
          created_at?: string
          id?: string
          mac?: string
          name?: string
          network_name?: string
          port_number?: number | null
          port_type?: Database["public"]["Enums"]["network_port_type"]
          socket_id?: string | null
          speed?: number | null
          vlan_id?: string | null
        }
        Update: {
          asset_id?: string
          comment?: string
          created_at?: string
          id?: string
          mac?: string
          name?: string
          network_name?: string
          port_number?: number | null
          port_type?: Database["public"]["Enums"]["network_port_type"]
          socket_id?: string | null
          speed?: number | null
          vlan_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "network_ports_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "network_ports_socket_id_fkey"
            columns: ["socket_id"]
            isOneToOne: false
            referencedRelation: "sockets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "network_ports_vlan_id_fkey"
            columns: ["vlan_id"]
            isOneToOne: false
            referencedRelation: "vlans"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_queue: {
        Row: {
          attempts: number
          body_html: string
          body_text: string
          created_at: string
          error: string
          id: string
          notification_id: string | null
          recipient_email: string
          recipient_name: string
          sent_at: string | null
          state: Database["public"]["Enums"]["queue_state"]
          subject: string
          ticket_id: string | null
        }
        Insert: {
          attempts?: number
          body_html?: string
          body_text?: string
          created_at?: string
          error?: string
          id?: string
          notification_id?: string | null
          recipient_email: string
          recipient_name?: string
          sent_at?: string | null
          state?: Database["public"]["Enums"]["queue_state"]
          subject: string
          ticket_id?: string | null
        }
        Update: {
          attempts?: number
          body_html?: string
          body_text?: string
          created_at?: string
          error?: string
          id?: string
          notification_id?: string | null
          recipient_email?: string
          recipient_name?: string
          sent_at?: string | null
          state?: Database["public"]["Enums"]["queue_state"]
          subject?: string
          ticket_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_queue_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_queue_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_recipients: {
        Row: {
          group_id: string | null
          id: string
          notification_id: string
          profile_id: string | null
          recipient_type: string
          user_id: string | null
        }
        Insert: {
          group_id?: string | null
          id?: string
          notification_id: string
          profile_id?: string | null
          recipient_type: string
          user_id?: string | null
        }
        Update: {
          group_id?: string | null
          id?: string
          notification_id?: string
          profile_id?: string | null
          recipient_type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_recipients_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "user_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_recipients_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_recipients_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "access_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_templates: {
        Row: {
          body_html: string
          body_text: string
          comment: string
          created_at: string
          id: string
          name: string
          subject: string
          updated_at: string
        }
        Insert: {
          body_html?: string
          body_text?: string
          comment?: string
          created_at?: string
          id?: string
          name: string
          subject?: string
          updated_at?: string
        }
        Update: {
          body_html?: string
          body_text?: string
          comment?: string
          created_at?: string
          id?: string
          name?: string
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          entity_id: string
          event: string
          id: string
          is_active: boolean
          item_type: string
          name: string
          template_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          event: string
          id?: string
          is_active?: boolean
          item_type?: string
          name: string
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          event?: string
          id?: string
          is_active?: boolean
          item_type?: string
          name?: string
          template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "notification_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      operating_systems: {
        Row: {
          comment: string
          id: string
          name: string
        }
        Insert: {
          comment?: string
          id?: string
          name: string
        }
        Update: {
          comment?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      phone_lines: {
        Row: {
          caller_name: string
          comment: string
          created_at: string
          entity_id: string
          id: string
          is_deleted: boolean
          line_type_id: string | null
          monthly_value: number
          name: string
          number: string
          state_id: string | null
          supplier_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          caller_name?: string
          comment?: string
          created_at?: string
          entity_id: string
          id?: string
          is_deleted?: boolean
          line_type_id?: string | null
          monthly_value?: number
          name: string
          number?: string
          state_id?: string | null
          supplier_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          caller_name?: string
          comment?: string
          created_at?: string
          entity_id?: string
          id?: string
          is_deleted?: boolean
          line_type_id?: string | null
          monthly_value?: number
          name?: string
          number?: string
          state_id?: string | null
          supplier_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "phone_lines_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "phone_lines_line_type_id_fkey"
            columns: ["line_type_id"]
            isOneToOne: false
            referencedRelation: "line_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "phone_lines_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "asset_states"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "phone_lines_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      priority_levels: {
        Row: {
          impact_enabled: boolean
          label: string
          level: number
          urgency_enabled: boolean
        }
        Insert: {
          impact_enabled?: boolean
          label: string
          level: number
          urgency_enabled?: boolean
        }
        Update: {
          impact_enabled?: boolean
          label?: string
          level?: number
          urgency_enabled?: boolean
        }
        Relationships: []
      }
      priority_matrix: {
        Row: {
          impact: number
          priority: number
          urgency: number
        }
        Insert: {
          impact: number
          priority: number
          urgency: number
        }
        Update: {
          impact?: number
          priority?: number
          urgency?: number
        }
        Relationships: []
      }
      problems: {
        Row: {
          assignee_group_id: string | null
          assignee_id: string | null
          category_id: string | null
          causes: string
          closed_at: string | null
          created_at: string
          description: string
          entity_id: string
          id: string
          impact: number
          impacts: string
          is_deleted: boolean
          priority_level: number
          requester_id: string | null
          resolved_at: string | null
          solution: string
          solution_type_id: string | null
          status: Database["public"]["Enums"]["problem_status"]
          symptoms: string
          title: string
          updated_at: string
          urgency: number
        }
        Insert: {
          assignee_group_id?: string | null
          assignee_id?: string | null
          category_id?: string | null
          causes?: string
          closed_at?: string | null
          created_at?: string
          description?: string
          entity_id: string
          id?: string
          impact?: number
          impacts?: string
          is_deleted?: boolean
          priority_level?: number
          requester_id?: string | null
          resolved_at?: string | null
          solution?: string
          solution_type_id?: string | null
          status?: Database["public"]["Enums"]["problem_status"]
          symptoms?: string
          title: string
          updated_at?: string
          urgency?: number
        }
        Update: {
          assignee_group_id?: string | null
          assignee_id?: string | null
          category_id?: string | null
          causes?: string
          closed_at?: string | null
          created_at?: string
          description?: string
          entity_id?: string
          id?: string
          impact?: number
          impacts?: string
          is_deleted?: boolean
          priority_level?: number
          requester_id?: string | null
          resolved_at?: string | null
          solution?: string
          solution_type_id?: string | null
          status?: Database["public"]["Enums"]["problem_status"]
          symptoms?: string
          title?: string
          updated_at?: string
          urgency?: number
        }
        Relationships: [
          {
            foreignKeyName: "problems_assignee_group_id_fkey"
            columns: ["assignee_group_id"]
            isOneToOne: false
            referencedRelation: "user_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "problems_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "itil_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "problems_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "problems_solution_type_id_fkey"
            columns: ["solution_type_id"]
            isOneToOne: false
            referencedRelation: "solution_types"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_flags: {
        Row: {
          enabled: boolean
          flag_key: string
          id: string
          profile_id: string
        }
        Insert: {
          enabled?: boolean
          flag_key: string
          id?: string
          profile_id: string
        }
        Update: {
          enabled?: boolean
          flag_key?: string
          id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_flags_flag_key_fkey"
            columns: ["flag_key"]
            isOneToOne: false
            referencedRelation: "flag_definitions"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "profile_flags_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "access_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_lifecycle: {
        Row: {
          allowed: boolean
          from_status: string
          id: string
          object_type: string
          profile_id: string
          to_status: string
        }
        Insert: {
          allowed?: boolean
          from_status: string
          id?: string
          object_type?: string
          profile_id: string
          to_status: string
        }
        Update: {
          allowed?: boolean
          from_status?: string
          id?: string
          object_type?: string
          profile_id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_lifecycle_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "access_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_rights: {
        Row: {
          can_create: boolean
          can_delete: boolean
          can_purge: boolean
          can_read: boolean
          can_read_notes: boolean
          can_update: boolean
          can_update_notes: boolean
          id: string
          object_key: string
          profile_id: string
        }
        Insert: {
          can_create?: boolean
          can_delete?: boolean
          can_purge?: boolean
          can_read?: boolean
          can_read_notes?: boolean
          can_update?: boolean
          can_update_notes?: boolean
          id?: string
          object_key: string
          profile_id: string
        }
        Update: {
          can_create?: boolean
          can_delete?: boolean
          can_purge?: boolean
          can_read?: boolean
          can_read_notes?: boolean
          can_update?: boolean
          can_update_notes?: boolean
          id?: string
          object_key?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_rights_object_key_fkey"
            columns: ["object_key"]
            isOneToOne: false
            referencedRelation: "right_definitions"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "profile_rights_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "access_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
        }
        Insert: {
          created_at?: string
          email?: string
          full_name?: string
          id: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
        }
        Relationships: []
      }
      project_costs: {
        Row: {
          begin_date: string | null
          budget_id: string | null
          end_date: string | null
          id: string
          name: string
          project_id: string
          value: number
        }
        Insert: {
          begin_date?: string | null
          budget_id?: string | null
          end_date?: string | null
          id?: string
          name?: string
          project_id: string
          value?: number
        }
        Update: {
          begin_date?: string | null
          budget_id?: string | null
          end_date?: string | null
          id?: string
          name?: string
          project_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_costs_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_costs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_items: {
        Row: {
          id: string
          item_id: string
          item_type: string
          project_id: string
        }
        Insert: {
          id?: string
          item_id: string
          item_type: string
          project_id: string
        }
        Update: {
          id?: string
          item_id?: string
          item_type?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_states: {
        Row: {
          color: string
          id: string
          is_finished: boolean
          name: string
        }
        Insert: {
          color?: string
          id?: string
          is_finished?: boolean
          name: string
        }
        Update: {
          color?: string
          id?: string
          is_finished?: boolean
          name?: string
        }
        Relationships: []
      }
      project_task_types: {
        Row: {
          id: string
          name: string
        }
        Insert: {
          id?: string
          name: string
        }
        Update: {
          id?: string
          name?: string
        }
        Relationships: []
      }
      project_tasks: {
        Row: {
          assigned_user_id: string | null
          created_at: string
          description: string
          effective_hours: number
          id: string
          name: string
          parent_id: string | null
          percent_done: number
          planned_end: string | null
          planned_hours: number
          planned_start: string | null
          project_id: string
          real_end: string | null
          real_start: string | null
          state_id: string | null
          task_type_id: string | null
          updated_at: string
        }
        Insert: {
          assigned_user_id?: string | null
          created_at?: string
          description?: string
          effective_hours?: number
          id?: string
          name: string
          parent_id?: string | null
          percent_done?: number
          planned_end?: string | null
          planned_hours?: number
          planned_start?: string | null
          project_id: string
          real_end?: string | null
          real_start?: string | null
          state_id?: string | null
          task_type_id?: string | null
          updated_at?: string
        }
        Update: {
          assigned_user_id?: string | null
          created_at?: string
          description?: string
          effective_hours?: number
          id?: string
          name?: string
          parent_id?: string | null
          percent_done?: number
          planned_end?: string | null
          planned_hours?: number
          planned_start?: string | null
          project_id?: string
          real_end?: string | null
          real_start?: string | null
          state_id?: string | null
          task_type_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_tasks_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "project_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tasks_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "project_states"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tasks_task_type_id_fkey"
            columns: ["task_type_id"]
            isOneToOne: false
            referencedRelation: "project_task_types"
            referencedColumns: ["id"]
          },
        ]
      }
      project_teams: {
        Row: {
          group_id: string | null
          id: string
          project_id: string
          role: string
          user_id: string | null
        }
        Insert: {
          group_id?: string | null
          id?: string
          project_id: string
          role?: string
          user_id?: string | null
        }
        Update: {
          group_id?: string | null
          id?: string
          project_id?: string
          role?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_teams_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "user_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_teams_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_types: {
        Row: {
          id: string
          name: string
        }
        Insert: {
          id?: string
          name: string
        }
        Update: {
          id?: string
          name?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          code: string
          comment: string
          created_at: string
          description: string
          end_date: string | null
          entity_id: string
          id: string
          is_deleted: boolean
          manager_group_id: string | null
          manager_id: string | null
          name: string
          parent_id: string | null
          percent_done: number
          priority_level: number
          project_type_id: string | null
          start_date: string | null
          state_id: string | null
          updated_at: string
        }
        Insert: {
          code?: string
          comment?: string
          created_at?: string
          description?: string
          end_date?: string | null
          entity_id: string
          id?: string
          is_deleted?: boolean
          manager_group_id?: string | null
          manager_id?: string | null
          name: string
          parent_id?: string | null
          percent_done?: number
          priority_level?: number
          project_type_id?: string | null
          start_date?: string | null
          state_id?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          comment?: string
          created_at?: string
          description?: string
          end_date?: string | null
          entity_id?: string
          id?: string
          is_deleted?: boolean
          manager_group_id?: string | null
          manager_id?: string | null
          name?: string
          parent_id?: string | null
          percent_done?: number
          priority_level?: number
          project_type_id?: string | null
          start_date?: string | null
          state_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_manager_group_id_fkey"
            columns: ["manager_group_id"]
            isOneToOne: false
            referencedRelation: "user_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_project_type_id_fkey"
            columns: ["project_type_id"]
            isOneToOne: false
            referencedRelation: "project_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "project_states"
            referencedColumns: ["id"]
          },
        ]
      }
      rack_items: {
        Row: {
          id: string
          is_front: boolean
          item_asset_id: string
          position: number
          rack_id: string
          units: number
        }
        Insert: {
          id?: string
          is_front?: boolean
          item_asset_id: string
          position?: number
          rack_id: string
          units?: number
        }
        Update: {
          id?: string
          is_front?: boolean
          item_asset_id?: string
          position?: number
          rack_id?: string
          units?: number
        }
        Relationships: [
          {
            foreignKeyName: "rack_items_item_asset_id_fkey"
            columns: ["item_asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rack_items_rack_id_fkey"
            columns: ["rack_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      recurrent_changes: {
        Row: {
          anticipation_minutes: number
          assignee_id: string | null
          calendar_id: string | null
          category_id: string | null
          comment: string
          created_at: string
          description: string
          end_date: string | null
          entity_id: string
          id: string
          impact: number
          is_active: boolean
          last_created_at: string | null
          name: string
          next_run_at: string | null
          periodicity_minutes: number
          start_date: string
          title: string
          updated_at: string
          urgency: number
        }
        Insert: {
          anticipation_minutes?: number
          assignee_id?: string | null
          calendar_id?: string | null
          category_id?: string | null
          comment?: string
          created_at?: string
          description?: string
          end_date?: string | null
          entity_id: string
          id?: string
          impact?: number
          is_active?: boolean
          last_created_at?: string | null
          name: string
          next_run_at?: string | null
          periodicity_minutes?: number
          start_date?: string
          title: string
          updated_at?: string
          urgency?: number
        }
        Update: {
          anticipation_minutes?: number
          assignee_id?: string | null
          calendar_id?: string | null
          category_id?: string | null
          comment?: string
          created_at?: string
          description?: string
          end_date?: string | null
          entity_id?: string
          id?: string
          impact?: number
          is_active?: boolean
          last_created_at?: string | null
          name?: string
          next_run_at?: string | null
          periodicity_minutes?: number
          start_date?: string
          title?: string
          updated_at?: string
          urgency?: number
        }
        Relationships: [
          {
            foreignKeyName: "recurrent_changes_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "calendars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurrent_changes_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "itil_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurrent_changes_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      recurrent_tickets: {
        Row: {
          anticipation_minutes: number
          assignee_id: string | null
          calendar_id: string | null
          category_id: string | null
          created_at: string
          description: string
          end_date: string | null
          entity_id: string
          id: string
          impact: number
          is_active: boolean
          last_created_at: string | null
          name: string
          next_run_at: string | null
          periodicity_minutes: number
          start_date: string
          title: string
          type: Database["public"]["Enums"]["ticket_type"]
          updated_at: string
          urgency: number
        }
        Insert: {
          anticipation_minutes?: number
          assignee_id?: string | null
          calendar_id?: string | null
          category_id?: string | null
          created_at?: string
          description?: string
          end_date?: string | null
          entity_id: string
          id?: string
          impact?: number
          is_active?: boolean
          last_created_at?: string | null
          name: string
          next_run_at?: string | null
          periodicity_minutes?: number
          start_date?: string
          title: string
          type?: Database["public"]["Enums"]["ticket_type"]
          updated_at?: string
          urgency?: number
        }
        Update: {
          anticipation_minutes?: number
          assignee_id?: string | null
          calendar_id?: string | null
          category_id?: string | null
          created_at?: string
          description?: string
          end_date?: string | null
          entity_id?: string
          id?: string
          impact?: number
          is_active?: boolean
          last_created_at?: string | null
          name?: string
          next_run_at?: string | null
          periodicity_minutes?: number
          start_date?: string
          title?: string
          type?: Database["public"]["Enums"]["ticket_type"]
          updated_at?: string
          urgency?: number
        }
        Relationships: [
          {
            foreignKeyName: "recurrent_tickets_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "calendars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurrent_tickets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "itil_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurrent_tickets_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      reminder_targets: {
        Row: {
          group_id: string | null
          id: string
          profile_id: string | null
          reminder_id: string
          user_id: string | null
        }
        Insert: {
          group_id?: string | null
          id?: string
          profile_id?: string | null
          reminder_id: string
          user_id?: string | null
        }
        Update: {
          group_id?: string | null
          id?: string
          profile_id?: string | null
          reminder_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reminder_targets_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "user_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_targets_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "access_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_targets_reminder_id_fkey"
            columns: ["reminder_id"]
            isOneToOne: false
            referencedRelation: "reminders"
            referencedColumns: ["id"]
          },
        ]
      }
      reminders: {
        Row: {
          author_id: string | null
          begin_at: string | null
          body: string
          created_at: string
          end_at: string | null
          entity_id: string
          id: string
          is_public: boolean
          name: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          begin_at?: string | null
          body?: string
          created_at?: string
          end_at?: string | null
          entity_id: string
          id?: string
          is_public?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          begin_at?: string | null
          body?: string
          created_at?: string
          end_at?: string | null
          entity_id?: string
          id?: string
          is_public?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminders_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      request_sources: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
        }
        Relationships: []
      }
      reservation_items: {
        Row: {
          asset_id: string
          comment: string
          created_at: string
          id: string
          is_active: boolean
        }
        Insert: {
          asset_id: string
          comment?: string
          created_at?: string
          id?: string
          is_active?: boolean
        }
        Update: {
          asset_id?: string
          comment?: string
          created_at?: string
          id?: string
          is_active?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "reservation_items_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: true
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          begin_at: string
          comment: string
          created_at: string
          end_at: string
          id: string
          repeat_group: string | null
          reservation_item_id: string
          user_id: string | null
        }
        Insert: {
          begin_at: string
          comment?: string
          created_at?: string
          end_at: string
          id?: string
          repeat_group?: string | null
          reservation_item_id: string
          user_id?: string | null
        }
        Update: {
          begin_at?: string
          comment?: string
          created_at?: string
          end_at?: string
          id?: string
          repeat_group?: string | null
          reservation_item_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reservations_reservation_item_id_fkey"
            columns: ["reservation_item_id"]
            isOneToOne: false
            referencedRelation: "reservation_items"
            referencedColumns: ["id"]
          },
        ]
      }
      right_definitions: {
        Row: {
          category: string
          has_notes: boolean
          key: string
          label: string
          sort: number
        }
        Insert: {
          category: string
          has_notes?: boolean
          key: string
          label: string
          sort?: number
        }
        Update: {
          category?: string
          has_notes?: boolean
          key?: string
          label?: string
          sort?: number
        }
        Relationships: []
      }
      rss_feeds: {
        Row: {
          author_id: string | null
          comment: string
          created_at: string
          entity_id: string
          id: string
          is_active: boolean
          is_public: boolean
          max_items: number
          name: string
          refresh_minutes: number
          url: string
        }
        Insert: {
          author_id?: string | null
          comment?: string
          created_at?: string
          entity_id: string
          id?: string
          is_active?: boolean
          is_public?: boolean
          max_items?: number
          name: string
          refresh_minutes?: number
          url: string
        }
        Update: {
          author_id?: string | null
          comment?: string
          created_at?: string
          entity_id?: string
          id?: string
          is_active?: boolean
          is_public?: boolean
          max_items?: number
          name?: string
          refresh_minutes?: number
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "rss_feeds_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      rule_actions: {
        Row: {
          field: string
          id: string
          rule_id: string
          value: string
        }
        Insert: {
          field: string
          id?: string
          rule_id: string
          value?: string
        }
        Update: {
          field?: string
          id?: string
          rule_id?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "rule_actions_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "business_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      rule_criteria: {
        Row: {
          field: string
          id: string
          operator: string
          rule_id: string
          value: string
        }
        Insert: {
          field: string
          id?: string
          operator?: string
          rule_id: string
          value?: string
        }
        Update: {
          field?: string
          id?: string
          operator?: string
          rule_id?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "rule_criteria_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "business_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      satisfaction_surveys: {
        Row: {
          answered_at: string | null
          comment: string
          created_at: string
          id: string
          score: number | null
          ticket_id: string
        }
        Insert: {
          answered_at?: string | null
          comment?: string
          created_at?: string
          id?: string
          score?: number | null
          ticket_id: string
        }
        Update: {
          answered_at?: string | null
          comment?: string
          created_at?: string
          id?: string
          score?: number | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "satisfaction_surveys_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: true
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_searches: {
        Row: {
          alert_threshold: number | null
          created_at: string
          criteria: Json
          entity_id: string | null
          id: string
          is_default: boolean
          is_public: boolean
          item_type: string
          name: string
          show_counter: boolean
          sort: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          alert_threshold?: number | null
          created_at?: string
          criteria?: Json
          entity_id?: string | null
          id?: string
          is_default?: boolean
          is_public?: boolean
          item_type: string
          name: string
          show_counter?: boolean
          sort?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          alert_threshold?: number | null
          created_at?: string
          criteria?: Json
          entity_id?: string | null
          id?: string
          is_default?: boolean
          is_public?: boolean
          item_type?: string
          name?: string
          show_counter?: boolean
          sort?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "saved_searches_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      server_rooms: {
        Row: {
          columns_count: number
          comment: string
          datacenter_id: string
          id: string
          name: string
          rows_count: number
        }
        Insert: {
          columns_count?: number
          comment?: string
          datacenter_id: string
          id?: string
          name: string
          rows_count?: number
        }
        Update: {
          columns_count?: number
          comment?: string
          datacenter_id?: string
          id?: string
          name?: string
          rows_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "server_rooms_datacenter_id_fkey"
            columns: ["datacenter_id"]
            isOneToOne: false
            referencedRelation: "datacenters"
            referencedColumns: ["id"]
          },
        ]
      }
      service_levels: {
        Row: {
          calendar_id: string | null
          comment: string
          created_at: string
          duration_unit: Database["public"]["Enums"]["duration_unit"]
          duration_value: number
          end_of_working_day: boolean
          entity_id: string
          id: string
          is_recursive: boolean
          kind: Database["public"]["Enums"]["service_level_kind"]
          name: string
          target: Database["public"]["Enums"]["service_level_target"]
          updated_at: string
        }
        Insert: {
          calendar_id?: string | null
          comment?: string
          created_at?: string
          duration_unit?: Database["public"]["Enums"]["duration_unit"]
          duration_value?: number
          end_of_working_day?: boolean
          entity_id: string
          id?: string
          is_recursive?: boolean
          kind?: Database["public"]["Enums"]["service_level_kind"]
          name: string
          target?: Database["public"]["Enums"]["service_level_target"]
          updated_at?: string
        }
        Update: {
          calendar_id?: string | null
          comment?: string
          created_at?: string
          duration_unit?: Database["public"]["Enums"]["duration_unit"]
          duration_value?: number
          end_of_working_day?: boolean
          entity_id?: string
          id?: string
          is_recursive?: boolean
          kind?: Database["public"]["Enums"]["service_level_kind"]
          name?: string
          target?: Database["public"]["Enums"]["service_level_target"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_levels_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "calendars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_levels_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      sla_policies: {
        Row: {
          created_at: string
          id: string
          priority: Database["public"]["Enums"]["ticket_priority"]
          resolution_minutes: number
          response_minutes: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          priority: Database["public"]["Enums"]["ticket_priority"]
          resolution_minutes?: number
          response_minutes?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          priority?: Database["public"]["Enums"]["ticket_priority"]
          resolution_minutes?: number
          response_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      sockets: {
        Row: {
          comment: string
          id: string
          location_id: string | null
          name: string
        }
        Insert: {
          comment?: string
          id?: string
          location_id?: string | null
          name: string
        }
        Update: {
          comment?: string
          id?: string
          location_id?: string | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "sockets_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      software: {
        Row: {
          category_id: string | null
          comment: string
          created_at: string
          entity_id: string
          id: string
          is_deleted: boolean
          is_helpdesk_visible: boolean
          manufacturer_id: string | null
          name: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          comment?: string
          created_at?: string
          entity_id: string
          id?: string
          is_deleted?: boolean
          is_helpdesk_visible?: boolean
          manufacturer_id?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          comment?: string
          created_at?: string
          entity_id?: string
          id?: string
          is_deleted?: boolean
          is_helpdesk_visible?: boolean
          manufacturer_id?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "software_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "software_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "software_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "software_manufacturer_id_fkey"
            columns: ["manufacturer_id"]
            isOneToOne: false
            referencedRelation: "manufacturers"
            referencedColumns: ["id"]
          },
        ]
      }
      software_categories: {
        Row: {
          comment: string
          id: string
          name: string
        }
        Insert: {
          comment?: string
          id?: string
          name: string
        }
        Update: {
          comment?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      software_installations: {
        Row: {
          asset_id: string
          id: string
          install_date: string | null
          license_id: string | null
          version_id: string
        }
        Insert: {
          asset_id: string
          id?: string
          install_date?: string | null
          license_id?: string | null
          version_id: string
        }
        Update: {
          asset_id?: string
          id?: string
          install_date?: string | null
          license_id?: string | null
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "software_installations_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "software_installations_license_id_fkey"
            columns: ["license_id"]
            isOneToOne: false
            referencedRelation: "software_licenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "software_installations_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "software_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      software_licenses: {
        Row: {
          allow_overquota: boolean
          comment: string
          created_at: string
          entity_id: string
          expire_date: string | null
          id: string
          license_type: string
          name: string
          other_serial: string
          parent_id: string | null
          quantity: number
          serial_number: string
          software_id: string
          version_buy_id: string | null
          version_use_id: string | null
        }
        Insert: {
          allow_overquota?: boolean
          comment?: string
          created_at?: string
          entity_id: string
          expire_date?: string | null
          id?: string
          license_type?: string
          name: string
          other_serial?: string
          parent_id?: string | null
          quantity?: number
          serial_number?: string
          software_id: string
          version_buy_id?: string | null
          version_use_id?: string | null
        }
        Update: {
          allow_overquota?: boolean
          comment?: string
          created_at?: string
          entity_id?: string
          expire_date?: string | null
          id?: string
          license_type?: string
          name?: string
          other_serial?: string
          parent_id?: string | null
          quantity?: number
          serial_number?: string
          software_id?: string
          version_buy_id?: string | null
          version_use_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "software_licenses_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "software_licenses_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "software_licenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "software_licenses_software_id_fkey"
            columns: ["software_id"]
            isOneToOne: false
            referencedRelation: "software"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "software_licenses_version_buy_id_fkey"
            columns: ["version_buy_id"]
            isOneToOne: false
            referencedRelation: "software_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "software_licenses_version_use_id_fkey"
            columns: ["version_use_id"]
            isOneToOne: false
            referencedRelation: "software_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      software_versions: {
        Row: {
          comment: string
          created_at: string
          id: string
          name: string
          os_id: string | null
          software_id: string
          state_id: string | null
        }
        Insert: {
          comment?: string
          created_at?: string
          id?: string
          name: string
          os_id?: string | null
          software_id: string
          state_id?: string | null
        }
        Update: {
          comment?: string
          created_at?: string
          id?: string
          name?: string
          os_id?: string | null
          software_id?: string
          state_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "software_versions_os_id_fkey"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "operating_systems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "software_versions_software_id_fkey"
            columns: ["software_id"]
            isOneToOne: false
            referencedRelation: "software"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "software_versions_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "asset_states"
            referencedColumns: ["id"]
          },
        ]
      }
      solution_types: {
        Row: {
          created_at: string
          entity_id: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "solution_types_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_types: {
        Row: {
          comment: string
          id: string
          name: string
        }
        Insert: {
          comment?: string
          id?: string
          name: string
        }
        Update: {
          comment?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          address: string
          city: string
          contact_email: string
          created_at: string
          document: string
          entity_id: string
          id: string
          is_deleted: boolean
          name: string
          notes: string
          phone: string
          postal_code: string
          state: string
          supplier_type_id: string | null
          updated_at: string
          website: string
        }
        Insert: {
          address?: string
          city?: string
          contact_email?: string
          created_at?: string
          document?: string
          entity_id?: string
          id?: string
          is_deleted?: boolean
          name: string
          notes?: string
          phone?: string
          postal_code?: string
          state?: string
          supplier_type_id?: string | null
          updated_at?: string
          website?: string
        }
        Update: {
          address?: string
          city?: string
          contact_email?: string
          created_at?: string
          document?: string
          entity_id?: string
          id?: string
          is_deleted?: boolean
          name?: string
          notes?: string
          phone?: string
          postal_code?: string
          state?: string
          supplier_type_id?: string | null
          updated_at?: string
          website?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suppliers_supplier_type_id_fkey"
            columns: ["supplier_type_id"]
            isOneToOne: false
            referencedRelation: "supplier_types"
            referencedColumns: ["id"]
          },
        ]
      }
      system_logs: {
        Row: {
          action: string
          created_at: string
          detail: string
          id: string
          item_id: string | null
          item_type: string
          severity: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          detail?: string
          id?: string
          item_id?: string | null
          item_type?: string
          severity?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          detail?: string
          id?: string
          item_id?: string | null
          item_type?: string
          severity?: string
          user_id?: string | null
        }
        Relationships: []
      }
      task_categories: {
        Row: {
          comment: string
          created_at: string
          entity_id: string
          id: string
          name: string
        }
        Insert: {
          comment?: string
          created_at?: string
          entity_id: string
          id?: string
          name: string
        }
        Update: {
          comment?: string
          created_at?: string
          entity_id?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_categories_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_actors: {
        Row: {
          alternative_email: string
          created_at: string
          group_id: string | null
          id: string
          role: Database["public"]["Enums"]["actor_role"]
          supplier_id: string | null
          ticket_id: string
          use_notification: boolean
          user_id: string | null
        }
        Insert: {
          alternative_email?: string
          created_at?: string
          group_id?: string | null
          id?: string
          role: Database["public"]["Enums"]["actor_role"]
          supplier_id?: string | null
          ticket_id: string
          use_notification?: boolean
          user_id?: string | null
        }
        Update: {
          alternative_email?: string
          created_at?: string
          group_id?: string | null
          id?: string
          role?: Database["public"]["Enums"]["actor_role"]
          supplier_id?: string | null
          ticket_id?: string
          use_notification?: boolean
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_actors_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "user_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_actors_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_actors_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_comments: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          id: string
          is_private: boolean
          source_id: string | null
          ticket_id: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          id?: string
          is_private?: boolean
          source_id?: string | null
          ticket_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          is_private?: boolean
          source_id?: string | null
          ticket_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_comments_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "request_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_comments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_costs: {
        Row: {
          begin_date: string | null
          budget_id: string | null
          comment: string
          cost_fixed: number
          cost_material: number
          cost_time: number
          created_at: string
          duration_minutes: number
          end_date: string | null
          id: string
          name: string
          ticket_id: string
        }
        Insert: {
          begin_date?: string | null
          budget_id?: string | null
          comment?: string
          cost_fixed?: number
          cost_material?: number
          cost_time?: number
          created_at?: string
          duration_minutes?: number
          end_date?: string | null
          id?: string
          name?: string
          ticket_id: string
        }
        Update: {
          begin_date?: string | null
          budget_id?: string | null
          comment?: string
          cost_fixed?: number
          cost_material?: number
          cost_time?: number
          created_at?: string
          duration_minutes?: number
          end_date?: string | null
          id?: string
          name?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_costs_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_costs_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_items: {
        Row: {
          asset_id: string
          created_at: string
          id: string
          ticket_id: string
        }
        Insert: {
          asset_id: string
          created_at?: string
          id?: string
          ticket_id: string
        }
        Update: {
          asset_id?: string
          created_at?: string
          id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_items_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_items_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_links: {
        Row: {
          created_at: string
          id: string
          link_type: Database["public"]["Enums"]["ticket_link_type"]
          linked_ticket_id: string
          ticket_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          link_type?: Database["public"]["Enums"]["ticket_link_type"]
          linked_ticket_id: string
          ticket_id: string
        }
        Update: {
          created_at?: string
          id?: string
          link_type?: Database["public"]["Enums"]["ticket_link_type"]
          linked_ticket_id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_links_linked_ticket_id_fkey"
            columns: ["linked_ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_links_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_solutions: {
        Row: {
          answer_comment: string
          answered_at: string | null
          answered_by: string | null
          author_id: string | null
          content: string
          created_at: string
          id: string
          solution_type_id: string | null
          state: Database["public"]["Enums"]["solution_state"]
          ticket_id: string
        }
        Insert: {
          answer_comment?: string
          answered_at?: string | null
          answered_by?: string | null
          author_id?: string | null
          content?: string
          created_at?: string
          id?: string
          solution_type_id?: string | null
          state?: Database["public"]["Enums"]["solution_state"]
          ticket_id: string
        }
        Update: {
          answer_comment?: string
          answered_at?: string | null
          answered_by?: string | null
          author_id?: string | null
          content?: string
          created_at?: string
          id?: string
          solution_type_id?: string | null
          state?: Database["public"]["Enums"]["solution_state"]
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_solutions_solution_type_id_fkey"
            columns: ["solution_type_id"]
            isOneToOne: false
            referencedRelation: "solution_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_solutions_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_tasks: {
        Row: {
          assigned_group_id: string | null
          assigned_user_id: string | null
          author_id: string | null
          category_id: string | null
          content: string
          created_at: string
          duration_minutes: number
          id: string
          is_private: boolean
          planned_end: string | null
          planned_start: string | null
          state: Database["public"]["Enums"]["task_state"]
          ticket_id: string
          updated_at: string
        }
        Insert: {
          assigned_group_id?: string | null
          assigned_user_id?: string | null
          author_id?: string | null
          category_id?: string | null
          content?: string
          created_at?: string
          duration_minutes?: number
          id?: string
          is_private?: boolean
          planned_end?: string | null
          planned_start?: string | null
          state?: Database["public"]["Enums"]["task_state"]
          ticket_id: string
          updated_at?: string
        }
        Update: {
          assigned_group_id?: string | null
          assigned_user_id?: string | null
          author_id?: string | null
          category_id?: string | null
          content?: string
          created_at?: string
          duration_minutes?: number
          id?: string
          is_private?: boolean
          planned_end?: string | null
          planned_start?: string | null
          state?: Database["public"]["Enums"]["task_state"]
          ticket_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_tasks_assigned_group_id_fkey"
            columns: ["assigned_group_id"]
            isOneToOne: false
            referencedRelation: "user_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_tasks_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "task_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_tasks_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_validations: {
        Row: {
          answer_comment: string
          answered_at: string | null
          approver_group_id: string | null
          approver_user_id: string | null
          id: string
          request_comment: string
          requested_at: string
          requested_by: string | null
          state: Database["public"]["Enums"]["validation_state"]
          ticket_id: string
        }
        Insert: {
          answer_comment?: string
          answered_at?: string | null
          approver_group_id?: string | null
          approver_user_id?: string | null
          id?: string
          request_comment?: string
          requested_at?: string
          requested_by?: string | null
          state?: Database["public"]["Enums"]["validation_state"]
          ticket_id: string
        }
        Update: {
          answer_comment?: string
          answered_at?: string | null
          approver_group_id?: string | null
          approver_user_id?: string | null
          id?: string
          request_comment?: string
          requested_at?: string
          requested_by?: string | null
          state?: Database["public"]["Enums"]["validation_state"]
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_validations_approver_group_id_fkey"
            columns: ["approver_group_id"]
            isOneToOne: false
            referencedRelation: "user_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_validations_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          asset_id: string | null
          assignee_id: string | null
          category: string
          category_id: string | null
          closed_at: string | null
          contract_id: string | null
          created_at: string
          deleted_at: string | null
          description: string
          entity_id: string
          external_id: string
          first_response_at: string | null
          id: string
          impact: number
          internal_resolution_due_at: string | null
          internal_response_due_at: string | null
          is_deleted: boolean
          kb_article_id: string | null
          location_id: string | null
          ola_tto_id: string | null
          ola_ttr_id: string | null
          pending_since: string | null
          priority: Database["public"]["Enums"]["ticket_priority"]
          priority_level: number
          priority_manual: boolean
          reporter_email: string
          reporter_name: string
          reporter_sector: string
          request_source_id: string | null
          requester_id: string | null
          resolution_due_at: string | null
          resolved_at: string | null
          response_due_at: string | null
          sla_tto_id: string | null
          sla_ttr_id: string | null
          status: Database["public"]["Enums"]["ticket_status"]
          taken_into_account_at: string | null
          title: string
          type: Database["public"]["Enums"]["ticket_type"]
          updated_at: string
          urgency: number
          validation_percent: number
          validation_state: Database["public"]["Enums"]["validation_state"]
          waiting_seconds: number
        }
        Insert: {
          asset_id?: string | null
          assignee_id?: string | null
          category?: string
          category_id?: string | null
          closed_at?: string | null
          contract_id?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string
          entity_id?: string
          external_id?: string
          first_response_at?: string | null
          id?: string
          impact?: number
          internal_resolution_due_at?: string | null
          internal_response_due_at?: string | null
          is_deleted?: boolean
          kb_article_id?: string | null
          location_id?: string | null
          ola_tto_id?: string | null
          ola_ttr_id?: string | null
          pending_since?: string | null
          priority?: Database["public"]["Enums"]["ticket_priority"]
          priority_level?: number
          priority_manual?: boolean
          reporter_email?: string
          reporter_name?: string
          reporter_sector?: string
          request_source_id?: string | null
          requester_id?: string | null
          resolution_due_at?: string | null
          resolved_at?: string | null
          response_due_at?: string | null
          sla_tto_id?: string | null
          sla_ttr_id?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          taken_into_account_at?: string | null
          title: string
          type?: Database["public"]["Enums"]["ticket_type"]
          updated_at?: string
          urgency?: number
          validation_percent?: number
          validation_state?: Database["public"]["Enums"]["validation_state"]
          waiting_seconds?: number
        }
        Update: {
          asset_id?: string | null
          assignee_id?: string | null
          category?: string
          category_id?: string | null
          closed_at?: string | null
          contract_id?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string
          entity_id?: string
          external_id?: string
          first_response_at?: string | null
          id?: string
          impact?: number
          internal_resolution_due_at?: string | null
          internal_response_due_at?: string | null
          is_deleted?: boolean
          kb_article_id?: string | null
          location_id?: string | null
          ola_tto_id?: string | null
          ola_ttr_id?: string | null
          pending_since?: string | null
          priority?: Database["public"]["Enums"]["ticket_priority"]
          priority_level?: number
          priority_manual?: boolean
          reporter_email?: string
          reporter_name?: string
          reporter_sector?: string
          request_source_id?: string | null
          requester_id?: string | null
          resolution_due_at?: string | null
          resolved_at?: string | null
          response_due_at?: string | null
          sla_tto_id?: string | null
          sla_ttr_id?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          taken_into_account_at?: string | null
          title?: string
          type?: Database["public"]["Enums"]["ticket_type"]
          updated_at?: string
          urgency?: number
          validation_percent?: number
          validation_state?: Database["public"]["Enums"]["validation_state"]
          waiting_seconds?: number
        }
        Relationships: [
          {
            foreignKeyName: "tickets_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "itil_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_kb_article_id_fkey"
            columns: ["kb_article_id"]
            isOneToOne: false
            referencedRelation: "kb_articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_ola_tto_id_fkey"
            columns: ["ola_tto_id"]
            isOneToOne: false
            referencedRelation: "service_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_ola_ttr_id_fkey"
            columns: ["ola_ttr_id"]
            isOneToOne: false
            referencedRelation: "service_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_request_source_id_fkey"
            columns: ["request_source_id"]
            isOneToOne: false
            referencedRelation: "request_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_sla_tto_id_fkey"
            columns: ["sla_tto_id"]
            isOneToOne: false
            referencedRelation: "service_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_sla_ttr_id_fkey"
            columns: ["sla_ttr_id"]
            isOneToOne: false
            referencedRelation: "service_levels"
            referencedColumns: ["id"]
          },
        ]
      }
      user_authorizations: {
        Row: {
          created_at: string
          entity_id: string
          id: string
          is_dynamic: boolean
          is_recursive: boolean
          profile_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          id?: string
          is_dynamic?: boolean
          is_recursive?: boolean
          profile_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          id?: string
          is_dynamic?: boolean
          is_recursive?: boolean
          profile_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_authorizations_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_authorizations_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "access_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_groups: {
        Row: {
          can_be_manager: boolean
          can_be_notified: boolean
          comment: string
          contains_assets: boolean
          contains_users: boolean
          created_at: string
          entity_id: string
          id: string
          is_recursive: boolean
          name: string
          parent_id: string | null
          updated_at: string
          visible_in_ticket: boolean
        }
        Insert: {
          can_be_manager?: boolean
          can_be_notified?: boolean
          comment?: string
          contains_assets?: boolean
          contains_users?: boolean
          created_at?: string
          entity_id: string
          id?: string
          is_recursive?: boolean
          name: string
          parent_id?: string | null
          updated_at?: string
          visible_in_ticket?: boolean
        }
        Update: {
          can_be_manager?: boolean
          can_be_notified?: boolean
          comment?: string
          contains_assets?: boolean
          contains_users?: boolean
          created_at?: string
          entity_id?: string
          id?: string
          is_recursive?: boolean
          name?: string
          parent_id?: string | null
          updated_at?: string
          visible_in_ticket?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "user_groups_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_groups_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "user_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_substitutes: {
        Row: {
          end_date: string | null
          id: string
          start_date: string | null
          substitute_id: string
          user_id: string
        }
        Insert: {
          end_date?: string | null
          id?: string
          start_date?: string | null
          substitute_id: string
          user_id: string
        }
        Update: {
          end_date?: string | null
          id?: string
          start_date?: string | null
          substitute_id?: string
          user_id?: string
        }
        Relationships: []
      }
      vlans: {
        Row: {
          comment: string
          entity_id: string
          id: string
          name: string
          tag: number | null
        }
        Insert: {
          comment?: string
          entity_id: string
          id?: string
          name: string
          tag?: number | null
        }
        Update: {
          comment?: string
          entity_id?: string
          id?: string
          name?: string
          tag?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vlans_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_working_time: {
        Args: { _calendar: string; _minutes: number; _start: string }
        Returns: string
      }
      apply_dictionary: {
        Args: { _target: string; _value: string }
        Returns: string
      }
      asset_residual_value: { Args: { _asset_id: string }; Returns: number }
      budget_spent: { Args: { _budget_id: string }; Returns: number }
      can_see_ticket: { Args: { _ticket_id: string }; Returns: boolean }
      cartridge_stock: { Args: { _item_id: string }; Returns: number }
      compute_priority: {
        Args: { _impact: number; _urgency: number }
        Returns: number
      }
      consumable_stock: { Args: { _item_id: string }; Returns: number }
      contract_end_date: { Args: { _contract_id: string }; Returns: string }
      enqueue_notification: {
        Args: { _content?: string; _event: string; _ticket_id: string }
        Returns: undefined
      }
      has_flag: { Args: { _flag: string; _user_id: string }; Returns: boolean }
      has_profile: {
        Args: { _profile_name: string; _user_id: string }
        Returns: boolean
      }
      has_right: {
        Args: { _action: string; _object: string; _user_id: string }
        Returns: boolean
      }
      has_right_in_entity: {
        Args: {
          _action: string
          _entity_id: string
          _object: string
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      license_usage: { Args: { _license_id: string }; Returns: number }
      log_system: {
        Args: {
          _action: string
          _detail?: string
          _item_id?: string
          _item_type?: string
          _severity?: string
        }
        Returns: undefined
      }
      my_permissions: { Args: never; Returns: Json }
      run_auto_close: { Args: never; Returns: number }
      run_automatic_action: { Args: { _code: string }; Returns: string }
      run_escalations: { Args: never; Returns: number }
      run_inventory_alerts: { Args: never; Returns: number }
      run_management_alerts: { Args: never; Returns: number }
      run_recurrent_changes: { Args: never; Returns: number }
      run_recurrent_tickets: { Args: never; Returns: number }
      run_satisfaction: { Args: never; Returns: number }
      service_level_minutes: { Args: { _id: string }; Returns: number }
      visible_entity_ids: { Args: { _user_id: string }; Returns: string[] }
      warranty_end_date: { Args: { _asset_id: string }; Returns: string }
    }
    Enums: {
      actor_role: "requerente" | "observador" | "atribuido"
      app_role: "admin" | "tecnico" | "usuario"
      asset_kind:
        | "computador"
        | "notebook"
        | "monitor"
        | "impressora"
        | "rede"
        | "telefonia"
        | "licenca"
        | "outro"
        | "periferico"
        | "cartucho"
        | "consumivel"
        | "rack"
        | "gabinete"
        | "pdu"
        | "passivo"
        | "nao_gerenciado"
        | "cabo"
        | "sim_card"
        | "software"
      asset_status: "em_uso" | "estoque" | "manutencao" | "descartado"
      change_status:
        | "nova"
        | "avaliacao"
        | "aprovacao"
        | "aceita"
        | "planejada"
        | "em_execucao"
        | "teste"
        | "qualificacao"
        | "aplicada"
        | "revisao"
        | "fechada"
        | "cancelada"
      component_kind:
        | "processador"
        | "memoria"
        | "disco"
        | "placa_rede"
        | "placa_video"
        | "placa_som"
        | "controladora"
        | "bateria"
        | "fonte"
        | "bios"
        | "gabinete_componente"
        | "outro"
      depreciation_type: "linear" | "decrescente" | "nenhuma"
      duration_unit: "minuto" | "hora" | "dia"
      glpi_interface: "standard" | "simplified"
      network_port_type:
        | "ethernet"
        | "wifi"
        | "loopback"
        | "alias"
        | "agregado"
        | "fibra"
      problem_status:
        | "novo"
        | "em_analise"
        | "aguardando"
        | "solucionado"
        | "fechado"
      queue_state: "pendente" | "enviado" | "erro"
      renewal_kind: "tacita" | "expressa" | "nenhuma"
      service_level_kind: "sla" | "ola"
      service_level_target: "tto" | "ttr"
      solution_state: "aguardando" | "aprovada" | "recusada"
      task_state: "informacao" | "a_fazer" | "concluida"
      ticket_link_type: "ligado" | "duplicado" | "filho" | "pai"
      ticket_priority: "baixa" | "media" | "alta" | "critica"
      ticket_status:
        | "aberto"
        | "em_andamento"
        | "aguardando"
        | "resolvido"
        | "fechado"
        | "planejado"
      ticket_type: "incidente" | "requisicao"
      validation_state: "nao_sujeito" | "aguardando" | "aprovado" | "recusado"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      actor_role: ["requerente", "observador", "atribuido"],
      app_role: ["admin", "tecnico", "usuario"],
      asset_kind: [
        "computador",
        "notebook",
        "monitor",
        "impressora",
        "rede",
        "telefonia",
        "licenca",
        "outro",
        "periferico",
        "cartucho",
        "consumivel",
        "rack",
        "gabinete",
        "pdu",
        "passivo",
        "nao_gerenciado",
        "cabo",
        "sim_card",
        "software",
      ],
      asset_status: ["em_uso", "estoque", "manutencao", "descartado"],
      change_status: [
        "nova",
        "avaliacao",
        "aprovacao",
        "aceita",
        "planejada",
        "em_execucao",
        "teste",
        "qualificacao",
        "aplicada",
        "revisao",
        "fechada",
        "cancelada",
      ],
      component_kind: [
        "processador",
        "memoria",
        "disco",
        "placa_rede",
        "placa_video",
        "placa_som",
        "controladora",
        "bateria",
        "fonte",
        "bios",
        "gabinete_componente",
        "outro",
      ],
      depreciation_type: ["linear", "decrescente", "nenhuma"],
      duration_unit: ["minuto", "hora", "dia"],
      glpi_interface: ["standard", "simplified"],
      network_port_type: [
        "ethernet",
        "wifi",
        "loopback",
        "alias",
        "agregado",
        "fibra",
      ],
      problem_status: [
        "novo",
        "em_analise",
        "aguardando",
        "solucionado",
        "fechado",
      ],
      queue_state: ["pendente", "enviado", "erro"],
      renewal_kind: ["tacita", "expressa", "nenhuma"],
      service_level_kind: ["sla", "ola"],
      service_level_target: ["tto", "ttr"],
      solution_state: ["aguardando", "aprovada", "recusada"],
      task_state: ["informacao", "a_fazer", "concluida"],
      ticket_link_type: ["ligado", "duplicado", "filho", "pai"],
      ticket_priority: ["baixa", "media", "alta", "critica"],
      ticket_status: [
        "aberto",
        "em_andamento",
        "aguardando",
        "resolvido",
        "fechado",
        "planejado",
      ],
      ticket_type: ["incidente", "requisicao"],
      validation_state: ["nao_sujeito", "aguardando", "aprovado", "recusado"],
    },
  },
} as const
