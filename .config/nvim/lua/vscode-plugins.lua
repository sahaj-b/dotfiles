return {
  require("plugins.treesitter"),

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

  { 'kylechui/nvim-surround', event = "VeryLazy", opts = { keymaps = { visual = "Y" }, }, },

  { "mg979/vim-visual-multi" },
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
