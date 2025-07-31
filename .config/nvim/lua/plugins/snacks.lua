return {
  "folke/snacks.nvim",
  priority = 1000,
  lazy = false,
  opts = {
    bigfile = { enabled = true },
    -- dashboard = { enabled = true },
    explorer = { enabled = true },
    indent = {
      enabled = true,
      animate = {
        enabled = false,
        -- duration = {
        --   step = 5,    -- ms per step
        --   total = 200, -- maximum duration
        -- },
      },
    },
    input = {
      enabled = true,
      win = {
        row = 0.3, -- 30% from top
      }
    },
    picker = {
      enabled = true,
      matcher = {
        cwd_bonus = true,
        frecency = true,
        history_bonus = true,
      },
      debug = {
        scores = false
      },
      toggles = {
        regex = "R",
      },
      win = {
        input = {
          keys = {
            -- ["<Esc>"] = { "close", mode = { "n", "i" } },
            ["<C-d>"] = { "preview_scroll_down", mode = { "i", "n" } },
            ["<C-u>"] = { "preview_scroll_up", mode = { "i", "n" } },
            ["R"] = { "toggle_regex", mode = { "n" } },
            ["H"] = { "toggle_hidden", mode = { "n" } },
            -- ["<C-d>"] = { "list_scroll_down", mode = { "n" } },
            -- ["<C-u>"] = { "list_scroll_up", mode = { "n" } },
          }
        }
      }
    },
    quickfile = { enabled = true },
    -- notifier = { enabled = true },
    -- scope = { enabled = true },
    -- scroll = { enabled = true },
    -- statuscolumn = { enabled = true },
    -- words = { enabled = true },
  }
}
