return {
  {
    "dmtrKovalenko/fff.nvim",
    build = "cargo build --release",
    opts = {
      prompt = ' ',
      layout = {
        prompt_position = 'left',
        preview_position = 'right',
        height = 0.9,
        width = 0.9,
      },
    },
    keys = {
      { "<leader>sf", function() require("fff").find_files() end, desc = "Open file picker" },
    },
  },
  {
    "dmmulroy/ts-error-translator.nvim",
    opts = {},
    filetypes = { "typescript", "typescriptreact", "javascript", "javascriptreact" },
  },
  {
    "sphamba/smear-cursor.nvim",
    opts = {
      -- smear_between_neighbor_lines = false,
      legacy_computing_symbols_support = true,
      smear_insert_mode = true,
      cursor_color = "#f5e0dc",

      stiffness = 0.8,                      -- 0.6      [0, 1]
      trailing_stiffness = 0.6,             -- 0.4      [0, 1]
      stiffness_insert_mode = 0.7,          -- 0.5      [0, 1]
      trailing_stiffness_insert_mode = 0.6, -- 0.5      [0, 1]
      damping = 1,                          -- 0.65     [0, 1]
      damping_insert_mode = 0.8,            -- 0.7      [0, 1]
      distance_stop_animating = 1,          -- 0.1      > 0
      delay_event_to_smear = 1
    },
  },
  -- {
  --   "supermaven-inc/supermaven-nvim",
  --   opts = {}
  -- },
  {
    "zbirenbaum/copilot.lua",
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
    }
  },
  { "https://github.com/tpope/vim-abolish", cmd = { "Abolish", "S", "Subvert" } },
  {
    'MeanderingProgrammer/render-markdown.nvim',
    dependencies = { 'nvim-treesitter/nvim-treesitter', 'nvim-tree/nvim-web-devicons' },
    ft = { 'markdown', 'codecompanion', 'Avante' },
    opts = {
      checkbox = {
        unchecked = {
          icon = '   󰄱'
        },
        checked = {
          icon = '   󰄲',
        },
        custom = {
          todo = { raw = '[-]', rendered = '   󰡖', highlight = '@number' },
        },

        right_pad = 2
      },
      code = {
        conceal_delimiters = false,
        language = false,
        border = 'none',
      },
      anti_conceal = {
        enabled = false,
      },
      win_options = {
        conceallevel = {
          rendered = 2,
        },
        concealcursor = {
          rendered = 'n',
        },
      }
    },
  },
  -- {
  --   "OXY2DEV/markview.nvim",
  --   config = function()
  --     require("markview").setup({
  --       highlight_groups = {
  --         -- Customize the highlight group used for bold text
  --         -- You may need to identify which specific group is used for bold
  --         MarkviewPalette1Fg = { fg = "#ff6b6b", bold = true },
  --       },
  --       preview = {
  --         filetypes = { "markdown", "codecompanion", "Avante" },
  --         ignore_buftypes = {},
  --         --   enable_hybrid_mode = true,
  --         --   hybrid_modes = { "i" },
  --         --   ignore_previews = {}
  --       },
  --       markdown_inline = {
  --         checkboxes = {
  --           checked = { text = "" },
  --           unchecked = { text = "", hl = "Normal", scope_hl = "Normal" },
  --           ["/"] = { text = "󰡖" }
  --         }
  --       },
  --       markdown = {
  --         list_items = {
  --           shift_width = 0,
  --           marker_minus = { add_padding = false },
  --           marker_plus = { add_padding = false },
  --           marker_star = { add_padding = false },
  --           marker_dot = { add_padding = false },
  --           marker_parenthesis = { add_padding = false },
  --         }
  --       },
  --       ft = { "markdown", "codecompanion", "avante" },
  --       cmd = "Markview"
  --     })
  --   end,
  -- },
  {
    "j-hui/fidget.nvim",
    opts = {
      notification = {
        window = {
          winblend = 0,
          -- border = "rounded",
          max_width = 150,
          x_padding = 0,
          align = "top",
        }
      },
      progress = {
        ignore = {
          function(msg)
            return string.find(msg.title, "lint:") or string.find(msg.title, "Diagnosing")
          end,
        }
      }
    },
  },
  {
    "folke/todo-comments.nvim",
    dependencies = { "nvim-lua/plenary.nvim" },
    event = "VeryLazy",
    opts = {}
  },
  -- {
  --   "kevinhwang91/nvim-bqf",
  --   ft = "qf",
  --   opts = {
  --     auto_resize_height = true,
  --     preview = {
  --       win_height = 12,
  --     }
  --   }
  -- },
  { 'AndreM222/copilot-lualine' },
  -- {
  --   "Davidyz/VectorCode",
  --   version = "*",                        -- optional, depending on whether you're on nightly or release
  --   build = "uv tool upgrade vectorcode", -- optional but recommended if you set `version = "*"`
  --   dependencies = { "nvim-lua/plenary.nvim" },
  --   opts = {}
  -- },
  { "williamboman/mason.nvim",              opts = {},                          cmd = "Mason" },
  { 'glacambre/firenvim',                   build = ":call firenvim#install(0)" },
  {
    "folke/lazydev.nvim",
    ft = "lua",
    opts = {},
  },
  -- {
  --   'vyfor/cord.nvim',
  --   event = "VeryLazy",
  --   build = ':Cord update',
  --   opts = {
  --     text = {
  --       workspace = "",
  --     }
  --   }
  -- },
  {
    "rest-nvim/rest.nvim",
    ft = { "http" },
    config = function()
      require("rest-nvim-extract")
    end
  },
  {
    "ThePrimeagen/refactoring.nvim",
    dependencies = {
      "nvim-lua/plenary.nvim",
      "nvim-treesitter/nvim-treesitter",
    },
    lazy = false,
    config = function()
      require("refactoring").setup({})
    end,
  },
  {
    'crispgm/nvim-tabline',
    dependencies = { 'nvim-tree/nvim-web-devicons' },
    lazy = true,
    opts = {
      show_icon = true,         -- show file extension icon
      modify_indicator = '[+]', -- modify indicator
      no_name = 'No name',      -- no name buffer name
      brackets = { '', '' },    -- file name brackets surrounding

    },
  },
  {
    'sindrets/diffview.nvim',
    -- { "jmbuhr/otter.nvim",      ft = "markdown" },
    opts = {
      win_config = {
        position = "bottom",
        -- width = 35,
        -- win_opts = {},
      },
    },
    cmd = { "DiffviewOpen", "DiffviewFileHistory", "DiffviewToggleFiles", "DiffviewFocusFiles" }
  },
  {
    'stevearc/oil.nvim',
    lazy = false,
    opts = { skip_confirm_for_simple_edits = true, delete_to_trash = true },
  },
  { "nvim-pack/nvim-spectre",                  cmd = "Spectre" },
  {
    "uga-rosa/ccc.nvim",
    config = function()
      local ccc = require("ccc")
      -- ccc.setup({ highlighter = { auto_enable = true, lsp = false }, pickers = { ccc.picker.ansi_escape() } })
      ccc.setup({ highlighter = { auto_enable = true, lsp = false } })
    end,
  },
  { "nvim-treesitter/nvim-treesitter-context", opts = { max_lines = 5 } },
  {
    "luckasranarison/tailwind-tools.nvim",
    name = "tailwind-tools",
    build = ":updateremoteplugins",
    dependencies = {
      "nvim-treesitter/nvim-treesitter",
    },
    opts = {
      -- document_color = { enabled = false },
      conceal = { symbol = "…" }
    },
    ft = { "javascript", "javascriptreact", "typescript", "typescriptreact", "html", "jsx", "tsx" }
  },
  {
    "windwp/nvim-ts-autotag",
    ft = { "javascript", "javascriptreact", "typescript", "typescriptreact", "html", "jsx", "tsx" },
    opts = {}
  },

  { "mg979/vim-visual-multi" },

  { 'wakatime/vim-wakatime', lazy = false },
  {
    "dhruvasagar/vim-table-mode",
    keys = { "<leader>tt", },
    config = function()
      vim.keymap.set("n", "<leader>tt", "<cmd>Tableize/|<cr>")
    end,
  },
  {
    "folke/flash.nvim",
    event = "VeryLazy",
    opts = { modes = { search = { enabled = false }, char = { enabled = false } } },
    keys = {
      { "s", mode = { "n", "x", "o" }, function() require("flash").jump() end, desc = "Flash" },
      {
        "S",
        mode = { "x", "o" },
        function() require("flash").treesitter() end,
        desc =
        "Flash Treesitter"
      },
      -- {
      --   "<c-g>",
      --   mode = { "c" },
      --   function() require("flash").toggle() end,
      --   desc =
      --   "Toggle Flash Search"
      -- },
    },

  },
  {
    "folke/which-key.nvim",
    event = "VeryLazy",
    init = function()
      vim.o.timeout = true
      vim.o.timeoutlen = 300
    end,
    opts = {}
  },

  { "mbbill/undotree" },
  { "catppuccin/nvim", name = "catppuccin", priority = 1000, opts = { integrations = { blink_cmp = true, fidget = true, } } },
  {
    'windwp/nvim-autopairs',
    event = "InsertEnter",
    opts = {},
  },
  {
    "hiphish/rainbow-delimiters.nvim",
  },
  -- {
  --   -- this opens spaces out [  ] which is annoying when making checkboxes
  --   'saghen/blink.pairs',
  --   version = '*',
  --   dependencies = 'saghen/blink.download',
  --   opts = {
  --     highlights = {
  --       enabled = true,
  --       groups = {
  --         '',
  --         '@markup.heading.1.markdown',
  --         '@markup.heading.3.markdown',
  --         '@markup.heading.4.markdown',
  --         '@markup.heading.2.markdown',
  --         '@markup.heading.5.markdown',
  --         '@markup.heading.6.markdown',
  --       },
  --     },
  --   }
  -- },
  { 'kylechui/nvim-surround', event = "VeryLazy", opts = { keymaps = { visual = "Y" }, }, },
  {
    "aserowy/tmux.nvim",
    opts = {
      copy_sync = {
        enable = false
      },
    }
  },
  {
    'kevinhwang91/nvim-ufo',
    dependencies = { 'kevinhwang91/promise-async' },
    opts = {
      close_fold_kinds_for_ft = {
        default = {} -- don't auto close any folds
      },
      open_fold_hl_timeout = 90,
      provider_selector = function()
        return { 'treesitter', 'indent' }
      end
    }
  },
  {
    "m4xshen/hardtime.nvim",
    dependencies = { "MunifTanjim/nui.nvim" },
    opts = {
      disable_mouse = false,
      disabled_keys = {
        ["<Up>"] = {},
        ["<Down>"] = {},
        ["<Left>"] = {},
        ["<Right>"] = {},

      },
      -- hint = false,
      max_time = 150,
      max_count = 8,

    }
  },
}
