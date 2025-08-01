return {
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
  { "https://github.com/tpope/vim-abolish" },
  {
    'MeanderingProgrammer/render-markdown.nvim',
    dependencies = { 'nvim-treesitter/nvim-treesitter', 'nvim-tree/nvim-web-devicons' },
    ft = { 'markdown', 'codecompanion', 'Avante' },
    opts = {
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
    "hiphish/rainbow-delimiters.nvim",
  },
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
  { "williamboman/mason.nvim",             opts = {},                          cmd = "Mason" },
  { 'glacambre/firenvim',                  build = ":call firenvim#install(0)" },
  {
    "folke/lazydev.nvim",
    ft = "lua",
    opts = {},
  },
  {
    'vyfor/cord.nvim',
    event = "VeryLazy",
    build = ':Cord update',
    opts = {
      text = {
        workspace = "",
      }
    }
  },
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
      {
        "<c-g>",
        mode = { "c" },
        function() require("flash").toggle() end,
        desc =
        "Toggle Flash Search"
      },
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

  -- {
  --   "lukas-reineke/indent-blankline.nvim",
  --   main = "ibl",
  --   opts = {},
  --   -- config = function()
  --   --   -- create autocmd when buffenter
  --   --   vim.api.nvim_create_autocmd("VimEnter", {
  --   --     callback = function()
  --   --       require("ibl").setup {
  --   --         scope = {
  --   --           enabled = true,
  --   --           highlight = { "IblScope" },
  --   --           show_start = false,
  --   --           show_end = false
  --   --         },
  --   --       }
  --   --     end,
  --   --   })
  --   -- end,
  -- },
  { "mbbill/undotree" },
  { "catppuccin/nvim", name = "catppuccin", priority = 1000, opts = { integrations = { blink_cmp = true, fidget = true, } } },
  {
    'windwp/nvim-autopairs',
    event = "InsertEnter",
    opts = {},
  },
  -- {
  --   'saghen/blink.pairs',
  --   version = '*',
  --   dependencies = 'saghen/blink.download',
  --   opts = {
  --     highlights = {
  --       enabled = true,
  --       groups = {
  --         '',
  --         'DiagnosticHint',
  --         'DiagnosticWarn',
  --         'DiagnosticOk',
  --         'DiagnosticError',
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
  -- { 'echasnovski/mini.cursorword', opts = {} },

  -- inconsistent
  -- {
  --   "zbirenbaum/neodim",
  --   event = "LspAttach",
  --   opts = {
  --     alpha = 0.75,
  --     blend_color = "#000000",
  --     hide = { underline = true, virtual_text = false, signs = true },
  --   }
  -- },
  -- {
  --   'linrongbin16/lsp-progress.nvim',
  --   config = function()
  --     require("lsp-progress").setup()
  --   end
  -- },
  -- {
  --   "epwalsh/obsidian.nvim",
  --   version = "*",
  --   lazy = true,
  --   ft = "markdown",
  --   dependencies = { "nvim-lua/plenary.nvim", },
  --   opts = {
  --     workspaces = { { name = "notes", path = "~/notes", }, },
  --     disable_frontmatter = true,
  --     -- daily_notes = {
  --     --     folder = "journal/daily",
  --     --     template = "daily.md",
  --     -- },
  --     templates = {
  --       subdir = "templates",
  --     },
  --   },
  -- },
  -- {
  --   "Exafunction/codeium.vim",
  --   cmd = "CodeiumEnable",
  --   config = function()
  --     vim.keymap.set('i', '<Tab>', function() return vim.fn['codeium#Accept']() end,
  --       { expr = true, silent = true })
  --     vim.keymap.set('i', '<C-x>', function() return vim.fn['codeium#Clear']() end,
  --       { expr = true, silent = true })
  --   end
  -- },
}
