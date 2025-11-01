return {

  -- {
  --   'MeanderingProgrammer/render-markdown.nvim',
  --   dependencies = { 'nvim-treesitter/nvim-treesitter', 'nvim-mini/mini.icons' },
  --   ft = { 'markdown', 'codecompanion', 'Avante' },
  --   opts = {
  --     checkbox = {
  --       unchecked = {
  --         icon = '   󰄱'
  --       },
  --       checked = {
  --         icon = '   󰄲',
  --       },
  --       custom = {
  --         todo = { raw = '[-]', rendered = '   󰡖', highlight = '@number' },
  --       },
  --
  --       right_pad = 2
  --     },
  --     code = {
  --       conceal_delimiters = false,
  --       language = false,
  --       border = 'none',
  --     },
  --     anti_conceal = {
  --       enabled = false,
  --     },
  --     win_options = {
  --       conceallevel = {
  --         rendered = 2,
  --       },
  --       concealcursor = {
  --         rendered = 'n',
  --       },
  --     }
  --   },
  -- },

  {
    "OXY2DEV/markview.nvim",
    config = function()
      require("markview").setup({
        experimental = { check_rtp_message = false },
        highlight_groups = {
          -- Customize the highlight group used for bold text
          -- You may need to identify which specific group is used for bold
          MarkviewPalette1Fg = { fg = "#ff6b6b", bold = true },
          MarkviewInlineCode = {
            bg = "#34344B",
            fg = "#A6E3A1"
          }
        },
        preview = {
          filetypes = { "markdown", "codecompanion", "Avante" },
          ignore_buftypes = {},
          --   enable_hybrid_mode = true,
          --   hybrid_modes = { "i" },
          --   ignore_previews = {}
        },
        markdown_inline = {
          checkboxes = {
            checked = { text = "    " },
            unchecked = { text = "    ", hl = "@markup", scope_hl = "@markup" },
            ["-"] = { text = "  󰡖  ", hl = "@comment", scope_hl = "@comment" }
          }
        },
        markdown = {
          list_items = {
            shift_width = 0,
            marker_minus = { add_padding = false },
            marker_plus = { add_padding = false },
            marker_star = { add_padding = false },
            marker_dot = { add_padding = false },
            marker_parenthesis = { add_padding = false },
          }
        },
        ft = { "markdown", "codecompanion", "avante" },
        cmd = "Markview"
      })
    end,
  },
}
