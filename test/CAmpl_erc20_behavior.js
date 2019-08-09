/*
  MIT License

  Copyright (c) 2016 Smart Contract Solutions, Inc.
  Copyright (c) 2019 Fragments, Inc.

  Permission is hereby granted, free of charge, to any person obtaining a copy
  of this software and associated documentation files (the "Software"), to deal
  in the Software without restriction, including without limitation the rights
  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
  copies of the Software, and to permit persons to whom the Software is
  furnished to do so, subject to the following conditions:

  The above copyright notice and this permission notice shall be included in all
  copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
  SOFTWARE.

  This file tests if the CAmpl contract confirms to the ERC20 specification.
  These test cases are inspired from OpenZepplin's ERC20 unit test.
  https://github.com/OpenZeppelin/openzeppelin-solidity/blob/master/test/token/ERC20/ERC20.test.js
*/
const BN = require('bn.js');
const chai = require('chai');
chai.use(require('bn-chai')(BN));
expect = chai.expect;

const _require = require('app-root-path').require;
const { setupCAmpl, toAmplDecimals, toCAmplDecimals, INITIAL_EXCHANGE_RATE } = _require('/test/helper');
const BlockchainCaller = _require('/util/blockchain_caller');
const chain = new BlockchainCaller(web3);

const AMPLS_SUPPLIED = toAmplDecimals(2000000); // 2m
const INITIAL_cAMPL_SUPPLY = AMPLS_SUPPLIED.div(INITIAL_EXCHANGE_RATE);
const transferAmount = toCAmplDecimals(10);
const unitTokenAmount = toCAmplDecimals(1);
const overdraftAmount = INITIAL_cAMPL_SUPPLY.add(unitTokenAmount);
const overdraftAmountPlusOne = overdraftAmount.add(unitTokenAmount);
const overdraftAmountMinusOne = overdraftAmount.sub(unitTokenAmount);
const transferAmountPlusOne = transferAmount.add(unitTokenAmount);
const transferAmountMinusOne = transferAmount.sub(unitTokenAmount);

let cAmpl, owner, anotherAccount, recipient, r;
async function setupContractAndAccounts (accounts) {
  owner = accounts[0];
  anotherAccount = accounts[8];
  recipient = accounts[9];
  [ampl, cAmpl] = await setupCAmpl(accounts);
  await ampl.approve(cAmpl.address, AMPLS_SUPPLIED);
  await cAmpl.mint(AMPLS_SUPPLIED);
}

contract('CAmpl:ERC20', function (accounts) {
  before('setup CAmpl contract', async function () {
    await setupContractAndAccounts(accounts);
  });

  describe('totalSupply', function () {
    it('returns the total amount of tokens', async function () {
      expect(await cAmpl.totalSupply.call()).to.eq.BN(INITIAL_cAMPL_SUPPLY);
    });
  });

  describe('balanceOf', function () {
    describe('when the requested account has no tokens', function () {
      it('returns zero', async function () {
        expect(await cAmpl.balanceOf.call(anotherAccount)).to.eq.BN(new BN(0));
      });
    });

    describe('when the requested account has some tokens', function () {
      it('returns the total amount of tokens', async function () {
        expect(await cAmpl.balanceOf.call(owner)).to.eq.BN(INITIAL_cAMPL_SUPPLY);
      });
    });
  });
});

contract('CAmpl:ERC20:transfer', function (accounts) {
  before('setup CAmpl contract', async function () {
    await setupContractAndAccounts(accounts);
  });

  describe('when the sender does NOT have enough balance', function () {
    it('reverts', async function () {
      expect(
        await chain.isCompoundException(cAmpl.transfer(recipient, overdraftAmount, { from: owner }))
      ).to.be.true;
    });
  });

  describe('when the sender has enough balance', function () {
    before(async function () {
      r = await cAmpl.transfer(recipient, transferAmount, { from: owner });
    });

    it('should transfer the requested amount', async function () {
      const senderBalance = await cAmpl.balanceOf.call(owner);
      const recipientBalance = await cAmpl.balanceOf.call(recipient);
      const supply = await cAmpl.totalSupply.call();
      expect(supply.sub(transferAmount)).to.eq.BN(senderBalance);
      expect(recipientBalance).to.eq.BN(transferAmount);
    });
    it('should emit a transfer event', async function () {
      expect(r.logs.length).to.equal(1);
      expect(r.logs[0].event).to.equal('Transfer');
      expect(r.logs[0].args.from).to.equal(owner);
      expect(r.logs[0].args.to).to.equal(recipient);
      expect(r.logs[0].args.amount).to.eq.BN(transferAmount);
    });
  });
});

contract('CAmpl:ERC20:transferFrom', function (accounts) {
  before('setup CAmpl contract', async function () {
    await setupContractAndAccounts(accounts);
  });

  describe('when the spender does NOT have enough approved balance', function () {
    describe('when the owner does NOT have enough balance', function () {
      it('reverts', async function () {
        await cAmpl.approve(anotherAccount, overdraftAmountMinusOne, { from: owner });
        expect(
          await chain.isCompoundException(cAmpl.transferFrom(owner, recipient, overdraftAmount, { from: anotherAccount }))
        ).to.be.true;
      });
    });

    describe('when the owner has enough balance', function () {
      it('reverts', async function () {
        await cAmpl.approve(anotherAccount, transferAmountMinusOne, { from: owner });
        expect(
          await chain.isCompoundException(cAmpl.transferFrom(owner, recipient, transferAmount, { from: anotherAccount }))
        ).to.be.true;
      });
    });
  });

  describe('when the spender has enough approved balance', function () {
    describe('when the owner does NOT have enough balance', function () {
      it('should fail', async function () {
        await cAmpl.approve(anotherAccount, overdraftAmount, { from: owner });
        expect(
          await chain.isCompoundException(cAmpl.transferFrom(owner, recipient, overdraftAmount, { from: anotherAccount }))
        ).to.be.true;
      });
    });

    describe('when the owner has enough balance', function () {
      let prevSenderBalance, r;
      before(async function () {
        prevSenderBalance = await cAmpl.balanceOf.call(owner);
        await cAmpl.approve(anotherAccount, transferAmount, { from: owner });
        r = await cAmpl.transferFrom(owner, recipient, transferAmount, { from: anotherAccount });
      });

      it('transfers the requested amount', async function () {
        const senderBalance = await cAmpl.balanceOf.call(owner);
        const recipientBalance = await cAmpl.balanceOf.call(recipient);
        expect(prevSenderBalance.sub(transferAmount)).to.eq.BN(senderBalance);
        expect(recipientBalance).to.eq.BN(transferAmount);
      });
      it('decreases the spender allowance', async function () {
        expect(await cAmpl.allowance(owner, anotherAccount)).to.eq.BN(0);
      });
      it('emits a transfer event', async function () {
        expect(r.logs.length).to.equal(1);
        expect(r.logs[0].event).to.equal('Transfer');
        expect(r.logs[0].args.from).to.equal(owner);
        expect(r.logs[0].args.to).to.equal(recipient);
        expect(r.logs[0].args.amount).to.eq.BN(transferAmount);
      });
    });
  });
});

contract('CAmpl:ERC20:approve', function (accounts) {
  before('setup CAmpl contract', async function () {
    await setupContractAndAccounts(accounts);
  });

  describe('when the spender is NOT the zero address', function () {
    describe('when the sender has enough balance', function () {
      describe('when there was no approved amount before', function () {
        before(async function () {
          await cAmpl.approve(anotherAccount, 0, { from: owner });
          r = await cAmpl.approve(anotherAccount, transferAmount, { from: owner });
        });

        it('approves the requested amount', async function () {
          expect((await cAmpl.allowance(owner, anotherAccount))).to.eq.BN(transferAmount);
        });

        it('emits an approval event', async function () {
          expect(r.logs.length).to.equal(1);
          expect(r.logs[0].event).to.equal('Approval');
          expect(r.logs[0].args.owner).to.equal(owner);
          expect(r.logs[0].args.spender).to.equal(anotherAccount);
          expect(r.logs[0].args.amount).to.eq.BN(transferAmount);
        });
      });

      describe('when the spender had an approved amount', function () {
        before(async function () {
          await cAmpl.approve(anotherAccount, new BN(1), { from: owner });
          r = await cAmpl.approve(anotherAccount, transferAmount, { from: owner });
        });

        it('approves the requested amount and replaces the previous one', async function () {
          expect((await cAmpl.allowance(owner, anotherAccount))).to.eq.BN(transferAmount);
        });

        it('emits an approval event', async function () {
          expect(r.logs.length).to.equal(1);
          expect(r.logs[0].event).to.equal('Approval');
          expect(r.logs[0].args.owner).to.equal(owner);
          expect(r.logs[0].args.spender).to.equal(anotherAccount);
          expect(r.logs[0].args.amount).to.eq.BN(transferAmount);
        });
      });
    });

    describe('when the sender does not have enough balance', function () {
      describe('when there was no approved amount before', function () {
        before(async function () {
          await cAmpl.approve(anotherAccount, 0, { from: owner });
          r = await cAmpl.approve(anotherAccount, overdraftAmount, { from: owner });
        });

        it('approves the requested amount', async function () {
          expect((await cAmpl.allowance(owner, anotherAccount))).to.eq.BN(overdraftAmount);
        });

        it('emits an approval event', async function () {
          expect(r.logs.length).to.equal(1);
          expect(r.logs[0].event).to.equal('Approval');
          expect(r.logs[0].args.owner).to.equal(owner);
          expect(r.logs[0].args.spender).to.equal(anotherAccount);
          expect(r.logs[0].args.amount).to.eq.BN(overdraftAmount);
        });
      });

      describe('when the spender had an approved amount', function () {
        before(async function () {
          await cAmpl.approve(anotherAccount, (1), { from: owner });
          r = await cAmpl.approve(anotherAccount, overdraftAmount, { from: owner });
        });

        it('approves the requested amount', async function () {
          expect(await cAmpl.allowance(owner, anotherAccount)).to.eq.BN(overdraftAmount);
        });

        it('emits an approval event', async function () {
          expect(r.logs.length).to.equal(1);
          expect(r.logs[0].event).to.equal('Approval');
          expect(r.logs[0].args.owner).to.equal(owner);
          expect(r.logs[0].args.spender).to.equal(anotherAccount);
          expect(r.logs[0].args.amount).to.eq.BN(overdraftAmount);
        });
      });
    });
  });
});
