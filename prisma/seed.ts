import { PrismaClient } from './generated/client';

const prisma = new PrismaClient();

const main = async () => {
  await prisma.user.createMany({
    data: [
      {
        userId: 'user_2o7lpyivp424ugMmq3NEer878V3', // replace with your own clerk user
        username: 'username',
        email: 'username@gmail.com',
        imageUrl: '/placeholder-user.jpg',
        role: 'admin',
        password: 'password'
      },
      {
        userId: 'user_000000000000000000000000001',
        username: 'username1',
        email: 'username1@gmail.com',
        imageUrl: '/placeholder-user.jpg',
        role: 'user',
        password: 'password1',
        withdrawn: BigInt(5000),
        createdAt: new Date('2024-11-01T00:00:00Z')
      },
      {
        userId: 'user_000000000000000000000000002',
        username: 'username2',
        email: 'username2@gmail.com',
        imageUrl: '/placeholder-user.jpg',
        role: 'user',
        password: 'password2',
        withdrawn: BigInt(4000),
        createdAt: new Date('2024-11-02T00:00:00Z')
      },
      {
        userId: 'user_000000000000000000000000003',
        username: 'username3',
        email: 'username3@gmail.com',
        imageUrl: '/placeholder-user.jpg',
        role: 'user',
        password: 'password3',
        withdrawn: BigInt(3000),
        createdAt: new Date('2024-11-03T00:00:00Z')
      },
      {
        userId: 'user_000000000000000000000000004',
        username: 'username4',
        email: 'username4@gmail.com',
        imageUrl: '/placeholder-user.jpg',
        role: 'user',
        password: 'password4',
        withdrawn: BigInt(2000),
        createdAt: new Date('2024-11-04T00:00:00Z')
      },
      {
        userId: 'user_000000000000000000000000005',
        username: 'username5',
        email: 'username5@gmail.com',
        imageUrl: '/placeholder-user.jpg',
        role: 'user',
        password: 'password5',
        withdrawn: BigInt(1000),
        createdAt: new Date('2024-11-05T00:00:00Z')
      }
    ]
  });
  await prisma.transaction.createMany({
    data: [
      {
        date: '2024-11-01T00:00:00Z',
        txid: 'd94f2de35705ec1a89cca9d9cb4bef07d3d7eab5facaa2ba0d6738e0a633430f',
        beefTx: {
          txid: 'd94f2de35705ec1a89cca9d9cb4bef07d3d7eab5facaa2ba0d6738e0a633430f'
        },
        vout: [
          {
            address: process.env.TREASURY_WALLET_WIF,
            satoshis: 1
          }
        ],
        txType: 'incoming',
        amount: 1,
        userId: "1"
      },
      {
        date: '2024-11-02T00:00:00Z',
        txid: '322f5922490eedf269e6698d148241bd32afa006864b71111141b1ed42fb15fa',
        beefTx: {
          txid: '322f5922490eedf269e6698d148241bd32afa006864b71111141b1ed42fb15fa'
        },
        vout: [
          {
            address: process.env.TREASURY_WALLET_WIF,
            satoshis: 2
          }
        ],
        txType: 'incoming',
        amount: 2,
        userId: "1"
      },
      {
        date: '2024-11-03T00:00:00Z',
        txid: '3b29125d868abdbeacb9b045a7722587253f9c33d25729a433e221191399035e',
        beefTx: {
          txid: '3b29125d868abdbeacb9b045a7722587253f9c33d25729a433e221191399035e'
        },
        vout: [
          {
            address: process.env.TREASURY_WALLET_WIF,
            satoshis: 3
          }
        ],
        txType: 'incoming',
        amount: 3,
        userId: "1"
      },
      {
        date: '2024-11-04T00:00:00Z',
        txid: 'd1649e77d87cd3253217efe2919e2dd1ed3c96069926ea9adeba1ee234e8e387',
        beefTx: {
          txid: 'd1649e77d87cd3253217efe2919e2dd1ed3c96069926ea9adeba1ee234e8e387'
        },
        vout: [
          {
            address: process.env.TREASURY_WALLET_WIF,
            satoshis: 4
          }
        ],
        txType: 'incoming',
        amount: 4,
        userId: "1"
      },
      {
        date: '2024-11-05T00:00:00Z',
        txid: '63d5325db04c2323e5914e4b28dc49410069d1ce78df776b28fdd9edd6b15d04',
        beefTx: {
          txid: '63d5325db04c2323e5914e4b28dc49410069d1ce78df776b28fdd9edd6b15d04'
        },
        vout: [
          {
            address: process.env.TREASURY_WALLET_WIF,
            satoshis: 5
          }
        ],
        txType: 'incoming',
        amount: 5,
        userId: "1"
      },
      {
        date: '2024-11-06T00:00:00Z',
        txid: 'a2bf3262e026af77813f9a6762468a3548f2310aa22e940a00ca8606a8c1e909',
        beefTx: {
          txid: 'a2bf3262e026af77813f9a6762468a3548f2310aa22e940a00ca8606a8c1e909'
        },
        vout: [
          {
            address: process.env.TREASURY_WALLET_WIF,
            satoshis: 6
          }
        ],
        txType: 'incoming',
        amount: 6,
        userId: "1"
      }
    ]
  });
};

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
