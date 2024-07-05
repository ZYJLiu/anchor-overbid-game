/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/overbid.json`.
 */
export type Overbid = {
  address: "8y7t2oh2JyvYUBGKYKt5i1EGXtwEG17xPHJ3RmP9jHqi";
  metadata: {
    name: "overbid";
    version: "0.1.0";
    spec: "0.1.0";
    description: "Created with Anchor";
  };
  instructions: [
    {
      name: "bid";
      discriminator: [199, 56, 85, 38, 146, 243, 37, 158];
      accounts: [
        {
          name: "payer";
          writable: true;
          signer: true;
        },
        {
          name: "owner";
          writable: true;
        },
        {
          name: "authority";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [97, 117, 116, 104];
              },
            ];
          };
        },
        {
          name: "mintAccount";
          writable: true;
        },
        {
          name: "sourceAccount";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "owner";
              },
              {
                kind: "account";
                path: "tokenProgram";
              },
              {
                kind: "account";
                path: "mintAccount";
              },
            ];
            program: {
              kind: "const";
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ];
            };
          };
        },
        {
          name: "destinationAccount";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "payer";
              },
              {
                kind: "account";
                path: "tokenProgram";
              },
              {
                kind: "account";
                path: "mintAccount";
              },
            ];
            program: {
              kind: "const";
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ];
            };
          };
        },
        {
          name: "tokenProgram";
          address: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
        },
        {
          name: "associatedTokenProgram";
          address: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
      ];
      args: [
        {
          name: "amount";
          type: "u64";
        },
      ];
    },
    {
      name: "initialize";
      discriminator: [175, 175, 109, 31, 13, 152, 155, 237];
      accounts: [
        {
          name: "payer";
          writable: true;
          signer: true;
        },
        {
          name: "authority";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [97, 117, 116, 104];
              },
            ];
          };
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
      ];
      args: [];
    },
    {
      name: "mint";
      discriminator: [51, 57, 225, 47, 182, 146, 137, 166];
      accounts: [
        {
          name: "payer";
          writable: true;
          signer: true;
        },
        {
          name: "authority";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [97, 117, 116, 104];
              },
            ];
          };
        },
        {
          name: "mintAccount";
          writable: true;
          signer: true;
        },
        {
          name: "tokenAccount";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "payer";
              },
              {
                kind: "account";
                path: "tokenProgram";
              },
              {
                kind: "account";
                path: "mintAccount";
              },
            ];
            program: {
              kind: "const";
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ];
            };
          };
        },
        {
          name: "tokenProgram";
          address: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
        },
        {
          name: "associatedTokenProgram";
          address: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
      ];
      args: [
        {
          name: "uri";
          type: "string";
        },
      ];
    },
    {
      name: "redeem";
      discriminator: [184, 12, 86, 149, 70, 196, 97, 225];
      accounts: [
        {
          name: "owner";
          writable: true;
          signer: true;
        },
        {
          name: "authority";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [97, 117, 116, 104];
              },
            ];
          };
        },
        {
          name: "mintAccount";
          writable: true;
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
      ];
      args: [];
    },
  ];
  accounts: [
    {
      name: "collection";
      discriminator: [48, 160, 232, 205, 191, 207, 26, 141];
    },
  ];
  errors: [
    {
      code: 6000;
      name: "missingOverbidField";
      msg: "Overbid field is missing in token metadata";
    },
    {
      code: 6001;
      name: "invalidOverbidValue";
      msg: "Invalid overbid value in token metadata";
    },
    {
      code: 6002;
      name: "bidTooLow";
      msg: "New bid must be higher than the current value to overbid";
    },
    {
      code: 6003;
      name: "wrongOwner";
      msg: "Wrong Owner";
    },
  ];
  types: [
    {
      name: "collection";
      type: {
        kind: "struct";
        fields: [
          {
            name: "items";
            type: {
              vec: {
                defined: {
                  name: "items";
                };
              };
            };
          },
          {
            name: "bump";
            type: "u8";
          },
        ];
      };
    },
    {
      name: "items";
      type: {
        kind: "struct";
        fields: [
          {
            name: "mint";
            type: "pubkey";
          },
          {
            name: "points";
            type: "u64";
          },
        ];
      };
    },
  ];
};
