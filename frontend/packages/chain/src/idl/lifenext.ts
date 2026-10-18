/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/lifenext.json`.
 */
export type Lifenext = {
  "address": "CWUPdsmDTAGh22Q7MGNHg5YhUzk5WNkcxQ7FN2etfQNS",
  "metadata": {
    "name": "lifenext",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "claim",
      "discriminator": [
        62,
        198,
        214,
        193,
        213,
        159,
        108,
        210
      ],
      "accounts": [
        {
          "name": "heir",
          "writable": true,
          "signer": true,
          "relations": [
            "vault"
          ]
        },
        {
          "name": "profile",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  102,
                  105,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "vault.owner",
                "account": "vault"
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "vault.owner",
                "account": "vault"
              },
              {
                "kind": "account",
                "path": "vault.id",
                "account": "vault"
              }
            ]
          }
        },
        {
          "name": "treasury",
          "writable": true,
          "address": "4hHj5bsNyVrXwJfwDPjdyoD2dJVxLHWNVTV7ULe8kCTa"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "closeProfile",
      "discriminator": [
        167,
        36,
        181,
        8,
        136,
        158,
        46,
        207
      ],
      "accounts": [
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "profile"
          ]
        },
        {
          "name": "profile",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  102,
                  105,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "rentPayer",
          "writable": true,
          "relations": [
            "profile"
          ]
        }
      ],
      "args": []
    },
    {
      "name": "createVault",
      "discriminator": [
        29,
        237,
        247,
        208,
        193,
        82,
        54,
        135
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "profile"
          ]
        },
        {
          "name": "profile",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  102,
                  105,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              },
              {
                "kind": "account",
                "path": "profile.nextVaultId",
                "account": "profile"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "heir",
          "type": "pubkey"
        },
        {
          "name": "uri",
          "type": "string"
        },
        {
          "name": "contentHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "deleteVault",
      "discriminator": [
        99,
        171,
        186,
        178,
        201,
        17,
        81,
        238
      ],
      "accounts": [
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "profile",
            "vault"
          ]
        },
        {
          "name": "profile",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  102,
                  105,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              },
              {
                "kind": "account",
                "path": "vault.id",
                "account": "vault"
              }
            ]
          }
        },
        {
          "name": "rentPayer",
          "writable": true,
          "relations": [
            "vault"
          ]
        }
      ],
      "args": []
    },
    {
      "name": "initProfile",
      "discriminator": [
        210,
        162,
        212,
        95,
        95,
        186,
        89,
        119
      ],
      "accounts": [
        {
          "name": "payer",
          "docs": [
            "Người trả rent: A, hoặc ví tài trợ phí của hệ thống."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "owner",
          "signer": true
        },
        {
          "name": "profile",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  102,
                  105,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "pay",
      "discriminator": [
        119,
        18,
        216,
        65,
        192,
        117,
        122,
        220
      ],
      "accounts": [
        {
          "name": "payer",
          "docs": [
            "Ai trả tiền (thường là A). Có thể khác `owner`, nhưng `owner` vẫn phải ký: thanh toán = A xác nhận còn sống."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "profile"
          ]
        },
        {
          "name": "profile",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  102,
                  105,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "treasury",
          "writable": true,
          "address": "4hHj5bsNyVrXwJfwDPjdyoD2dJVxLHWNVTV7ULe8kCTa"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "months",
          "type": "u16"
        }
      ]
    },
    {
      "name": "updateVault",
      "discriminator": [
        67,
        229,
        185,
        188,
        226,
        11,
        210,
        60
      ],
      "accounts": [
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "vault"
          ]
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              },
              {
                "kind": "account",
                "path": "vault.id",
                "account": "vault"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "heir",
          "type": "pubkey"
        },
        {
          "name": "uri",
          "type": "string"
        },
        {
          "name": "contentHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "profile",
      "discriminator": [
        184,
        101,
        165,
        188,
        95,
        63,
        127,
        188
      ]
    },
    {
      "name": "vault",
      "discriminator": [
        211,
        8,
        232,
        43,
        2,
        152,
        117,
        119
      ]
    }
  ],
  "events": [
    {
      "name": "paid",
      "discriminator": [
        240,
        193,
        17,
        238,
        238,
        210,
        129,
        235
      ]
    },
    {
      "name": "profileClosed",
      "discriminator": [
        240,
        230,
        21,
        163,
        106,
        38,
        166,
        89
      ]
    },
    {
      "name": "vaultClaimed",
      "discriminator": [
        232,
        48,
        41,
        194,
        218,
        163,
        56,
        86
      ]
    },
    {
      "name": "vaultDeleted",
      "discriminator": [
        89,
        143,
        126,
        144,
        12,
        23,
        165,
        184
      ]
    },
    {
      "name": "vaultSaved",
      "discriminator": [
        100,
        95,
        2,
        51,
        177,
        117,
        123,
        1
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "invalidMonths",
      "msg": "Phải thanh toán ít nhất 1 tháng"
    },
    {
      "code": 6001,
      "name": "prepayLimitExceeded",
      "msg": "Chỉ được trả trước tối đa 90 ngày"
    },
    {
      "code": 6002,
      "name": "stillOverdue",
      "msg": "Khoản thanh toán chưa đủ để che phần đã quá hạn"
    },
    {
      "code": 6003,
      "name": "notReleasedYet",
      "msg": "Chưa tới hạn bàn giao"
    },
    {
      "code": 6004,
      "name": "alreadyClaimed",
      "msg": "Két đã được người nhận lấy"
    },
    {
      "code": 6005,
      "name": "notHeir",
      "msg": "Người ký không phải người nhận của két này"
    },
    {
      "code": 6006,
      "name": "uriTooLong",
      "msg": "Đường dẫn dữ liệu quá dài"
    },
    {
      "code": 6007,
      "name": "heirIsOwner",
      "msg": "Người nhận không được là chính chủ két"
    },
    {
      "code": 6008,
      "name": "vaultsRemaining",
      "msg": "Còn két chưa xoá"
    },
    {
      "code": 6009,
      "name": "wrongTreasury",
      "msg": "Sai ví nhận phí"
    },
    {
      "code": 6010,
      "name": "overflow",
      "msg": "Tràn số"
    }
  ],
  "types": [
    {
      "name": "paid",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "months",
            "type": "u16"
          },
          {
            "name": "paidUntil",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "profile",
      "docs": [
        "Hồ sơ của A (người dùng). Thanh toán = check-in: `paid_until` là mốc A đã trả tới."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "paidUntil",
            "docs": [
              "A đã trả tới thời điểm này. Quá `paid_until + OVERDUE_SECONDS` mà chưa trả → bàn giao."
            ],
            "type": "i64"
          },
          {
            "name": "debtSettledFor",
            "docs": [
              "`paid_until` tại lúc phần nợ đã được một người nhận trả — mỗi lần A ngừng trả chỉ thu nợ một lần."
            ],
            "type": "i64"
          },
          {
            "name": "nextVaultId",
            "type": "u32"
          },
          {
            "name": "vaultCount",
            "type": "u32"
          },
          {
            "name": "rentPayer",
            "docs": [
              "Ai đặt cọc rent (A hoặc ví tài trợ phí của hệ thống) → hoàn lại khi đóng."
            ],
            "type": "pubkey"
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "profileClosed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "vault",
      "docs": [
        "Một két, giao cho đúng một người nhận (B). Nội dung đã mã hoá nằm ngoài chuỗi tại `uri`.",
        "Thứ tự trường cố định ở đầu (owner, heir, claimed) để Lit đọc được theo offset."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "heir",
            "type": "pubkey"
          },
          {
            "name": "claimed",
            "type": "bool"
          },
          {
            "name": "id",
            "type": "u32"
          },
          {
            "name": "claimedAt",
            "type": "i64"
          },
          {
            "name": "updatedAt",
            "type": "i64"
          },
          {
            "name": "contentHash",
            "docs": [
              "SHA-256 của gói đã mã hoá — người nhận kiểm tra dữ liệu tải về không bị tráo."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "rentPayer",
            "type": "pubkey"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "uri",
            "type": "string"
          }
        ]
      }
    },
    {
      "name": "vaultClaimed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "heir",
            "type": "pubkey"
          },
          {
            "name": "debtPaid",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "vaultDeleted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "vault",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "vaultSaved",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "heir",
            "type": "pubkey"
          }
        ]
      }
    }
  ],
  "constants": [
    {
      "name": "profileSeed",
      "type": "bytes",
      "value": "[112, 114, 111, 102, 105, 108, 101]"
    },
    {
      "name": "vaultSeed",
      "type": "bytes",
      "value": "[118, 97, 117, 108, 116]"
    }
  ]
};
