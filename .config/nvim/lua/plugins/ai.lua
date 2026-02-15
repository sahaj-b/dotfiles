return {
  {
    "ThePrimeagen/99",
    config = function()
      local _99 = require("99")

      -- local cwd = vim.uv.cwd()
      -- local basename = vim.fs.basename(cwd)
      _99.setup({
        -- logger = {
        --   level = _99.DEBUG,
        --   type = "file",
        --   path = "/tmp/" .. basename .. ".99.debug",
        --   print_on_error = true,
        -- },
        model = "opencode/minimax-m2.5-free",
        source = "blink",
        md_files = {
          "AGENT.md",
        },
      })

      vim.keymap.set("v", "<leader>9v", function()
        _99.visual()
      end)

      vim.keymap.set("v", "<leader>9s", function()
        _99.stop_all_requests()
      end)
    end,
  },

  {
    "olimorris/codecompanion.nvim",
    dependencies = {
      "nvim-lua/plenary.nvim",
      "ravitemer/codecompanion-history.nvim",
      -- {
      --   "ravitemer/mcphub.nvim",
      --   build = "pnpm install -g mcp-hub@latest",
      --   config = function()
      --     require("mcphub").setup({ auto_approve = true })
      --   end,
      -- },
      {
        "echasnovski/mini.diff",
        version = false,
        config = function()
          require("mini.diff").setup({
            source = require("mini.diff").gen_source.none(),
          })
        end,
      },
    },
    cmd = { "CodeCompanion", "CodeCompanionChat", "CodeCompanionActions", "CodeCompanionCmd", "CodeCompanionHistory" },
    keys = {
      {
        "<leader>ci",
        ":CodeCompanion<cr>",
        desc = "Start CodeCompanion",
        mode = { "n", "v" },
      },
      {
        "<leader>aa",
        ":CodeCompanionActions<cr>",
        desc = "CodeCompanion Actions",
        mode = { "n", "v" },
      },
      {
        "<leader><leader>a",
        ":CodeCompanionChat Toggle<cr>",
        desc = "Toggle CodeCompanion Chat",
        mode = "n",
      },
    },
    config = function()
      local inlineAdapter = "copilot_gpt"
      require("codecompanion").setup({
        adapters = {
          http = {
            copilot = function()
              return require("codecompanion.adapters").extend("copilot", {
                schema = {
                  model = { default = "claude-sonnet-4.5" },
                },
              })
            end,
            copilot_grok = function()
              return require("codecompanion.adapters").extend("copilot", {
                schema = {
                  model = { default = "grok-code-fast-1" },
                },
              })
            end,
            copilot_sonnet = function()
              return require("codecompanion.adapters").extend("copilot", {
                schema = {
                  model = { default = "claude-sonnet-4.5" },
                },
              })
            end,
            copilot_gpt = function()
              return require("codecompanion.adapters").extend("copilot", {
                schema = {
                  model = { default = "gpt-4.1" },
                },
              })
            end,
            copilot_gpt5 = function()
              return require("codecompanion.adapters").extend("copilot", {
                schema = {
                  model = { default = "gpt-5-mini" },
                },
              })
            end,
            gemini = function()
              return require("codecompanion.adapters").extend("gemini", {
                env = {
                  api_key = "cmd:echo -n $GOOGLE_API_KEY",
                },
              })
            end,
          },
        },

        interactions = {
          chat = {
            adapter = "copilot",
            tools = {
              ["insert_edit_into_file"] = {
                opts = {
                  requires_approval = {
                    buffer = false,
                    file = true,
                  },
                  user_confirmation = false,
                },
              },
            },
            variables = {
              ["mkcontext"] = {
                callback = function()
                  local handle = io.popen("mkcontext")
                  if handle then
                    local result = handle:read("*a")
                    handle:close()
                    return result
                  else
                    return "Failed to run mkcontext command"
                  end
                end,
                description =
                "Get the output of mkcontext command (gives the tree structure and all the files' content in current directory)",
                opts = {
                  contains_code = false,
                },
              },
            },
          },
          inline = {
            adapter = inlineAdapter,
            keymaps = {
              accept_change = {
                modes = { n = "ga" },
                description = "Accept the suggested change",
              },
              reject_change = {
                modes = { n = "gr" },
                opts = { nowait = true },
                description = "Reject the suggested change",
              },
            },
          },
        },

        display = {
          chat = {
            auto_scroll = false,
          },
          diff = {
            provider = "mini_diff",
          },
        },

        extensions = {
          history = {
            enabled = true,
            opts = {
              keymap = "gh",
              auto_generate_title = true,
              continue_last_chat = false,
              delete_on_clearing_chat = true,
              dir_to_save = vim.fn.stdpath("data") .. "/codecompanion-history",
            },
          },
        },

        prompt_library = {
          default = {
            strategy = "chat",
            description = "Default chat prompt",
            opts = {
              -- If your proompt() returns a string/table, use it here:
              system_prompt = require("plugins.codecompanion.proompt"),
              -- or if proompt is a markdown file/string:
              -- system_prompt = function() return require("plugins.codecompanion.proompt") end,
            },
          },
        },
      })

      -- this prewarms copilot adapter so it doesnt block the first time you use it
      vim.defer_fn(function()
        local adapters = require("codecompanion.adapters")
        local get_models = require("codecompanion.adapters.http.copilot.get_models")
        local token = require("codecompanion.adapters.http.copilot.token")

        local fetched_token = token.fetch({ force = true })
        if fetched_token and fetched_token.copilot_token then
          local adapter = adapters.resolve(inlineAdapter)
          get_models.choices(adapter, { token = fetched_token, async = true })
        end
      end, 100)
    end,
    init = function()
      require("plugins.codecompanion.fidget-spinner"):init()
    end,
  },

  {
    "zbirenbaum/copilot.lua",
    dependencies = {
      -- {
      --   "copilotlsp-nvim/copilot-lsp",
      --   init = function()
      --     vim.g.copilot_nes_debounce = 300
      --   end,
      --   opts = {
      --     nes = {
      --       move_count_threshold = 10,
      --     }
      --   }
      -- }
    },
    cmd = "Copilot",
    event = "InsertEnter",
    opts = {
      filetypes = {
        ["*"] = true
      },
      suggestion = {
        auto_trigger = true,
        debounce = 50,
        keymap = {
          accept = "<Tab>",
        }
      },
      -- nes = {
      --   enabled = true,
      --   keymap = {
      --     accept_and_goto = false,
      --     accept = false,
      --     dismiss = "<Esc>",
      --   },
      -- },
    },
    -- init = function()
    --   vim.keymap.set("n", "<Tab>", function()
    --     local ok, nes = pcall(require, "copilot-lsp.nes")
    --     if ok then
    --       if not nes.walk_cursor_start_edit() then
    --         nes.apply_pending_nes()
    --         nes.walk_cursor_end_edit()
    --       end
    --     end
    --   end, { desc = "Accept Copilot NES suggestion" })
    -- end,
  },

  { 'AndreM222/copilot-lualine' }


  -- {
  --   "folke/sidekick.nvim",
  --   opts = {
  --     -- add any options here
  --     cli = {
  --       mux = {
  --         backend = "tmux",
  --         enabled = true,
  --       },
  --     },
  --     nes = {
  --       enabled = false,
  --     },
  --   },
  --   keys = {
  --     {
  --       "<tab>",
  --       function()
  --         -- if there is a next edit, jump to it, otherwise apply it if any
  --         if not require("sidekick").nes_jump_or_apply() then
  --           return "<Tab>" -- fallback to normal tab
  --         end
  --       end,
  --       expr = true,
  --       desc = "Goto/Apply Next Edit Suggestion",
  --     },
  --   },
  -- },
}
