//SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;

import {Create2} from "@openzeppelin/contracts/utils/Create2.sol";
import {Spawn} from "../packages/Spawn.sol";
import {IERC20WithDetail} from "../interfaces/IERC20WithDetail.sol";
import {IHodlERC20} from "../interfaces/IHodlERC20.sol";

/**
 * @title HodlSpawner
 * @notice This contract spawns and initializes eip-1167 minimal proxies that
 * point to existing logic contracts.
 * @notice This contract was modified from Spawner.sol
 * https://github.com/0age/Spawner/blob/master/contracts/Spawner.sol to fit into our factory
 */
contract HodlSpawner {
  // fixed salt value because we will only deploy an Hodl pool with the same init value once
  bytes32 private constant SALT = bytes32(0);

  /**
   * @notice internal function for spawning an eip-1167 minimal proxy using `CREATE2`
   * @param logicContract address of the logic contract
   * @param initializationCalldata calldata that will be supplied to the `DELEGATECALL`
   * from the spawned contract to the logic contract during contract creation
   * @return spawnedContract the address of the newly-spawned contract
   */
  function _spawn(address logicContract, bytes memory initializationCalldata)
    internal
    returns (address)
  {
    // place the creation code and constructor args of the contract to spawn in memory
    bytes memory initCode = abi.encodePacked(
      type(Spawn).creationCode,
      abi.encode(logicContract, initializationCalldata)
    );

    // spawn the contract using `CREATE2`
    return Create2.deploy(0, SALT, initCode);
  }

  /**
   * @notice internal view function for finding the address of the standard
   * eip-1167 minimal proxy created using `CREATE2` with a given logic contract
   * and initialization calldata payload
   * @param logicContract address of the logic contract
   * @param initializationCalldata calldata that will be supplied to the `DELEGATECALL`
   * from the spawned contract to the logic contract during contract creation
   * @return target address of the next spawned minimal proxy contract with the
   * given parameters.
   */
  function _computeAddress(address logicContract, bytes memory initializationCalldata)
    internal
    view
    returns (address target)
  {
    // place the creation code and constructor args of the contract to spawn in memory
    bytes memory initCode = abi.encodePacked(
      type(Spawn).creationCode,
      abi.encode(logicContract, initializationCalldata)
    );
    // get target address using the constructed initialization code
    bytes32 initCodeHash = keccak256(initCode);

    target = Create2.computeAddress(SALT, initCodeHash);
  }
}

/**
 * @title A factory to create hToken
 * @notice Create new hToken and keep track of all hToken addresses
 * @dev Calculate contract address before each creation with CREATE2
 * and deploy eip-1167 minimal proxies for the logic contract
 */
contract HodlFactory is HodlSpawner {
  /// @dev mapping from parameters hash to its deployed address
  mapping(bytes32 => address) private _idToAddress;

  /// @dev if the address is a valid hToken deployed by this factory
  mapping(address => bool) private _isValidHToken;

  address implementation;

  constructor(address _implementation) {
    implementation = _implementation;
  }

  /// @notice emitted when the factory creates a new hToken "barrel"
  event HodlCreated(
    address contractAddress,
    address indexed token,
    uint256 indexed penalty,
    uint256 lockWindow,
    uint256 indexed expiry,
    uint256 feePortion,
    uint256 n,
    address feeRecipient,
    address creator,
    address bonusToken
  );

  /**
   * @notice create new HodlERC20 proxy
   * @dev deploy an eip-1167 minimal proxy with CREATE2 and register it to the whitelist module
   * @param _token token to hold
   * @param _penalty penalty 1 out of 1000
   * @param _lockWindow duration locked before expiry
   * @param _expiry expiry timestamp
   * @param _fee fee out of every 1000 penalty
   * @param _feeRecipient address that collect fees
   * @param _bonusToken extra reward token (optional, set to zero address if using just the base token)
   * @return newHodl newly deployed contract address
   */
  function createHodlERC20(
    address _token,
    uint256 _penalty,
    uint256 _lockWindow,
    uint256 _expiry,
    uint256 _fee,
    uint256 _n,
    address _feeRecipient,
    address _bonusToken
  ) external returns (address newHodl) {
    bytes32 id = _getHodlId(
      _token,
      _penalty,
      _lockWindow,
      _expiry,
      _fee,
      _n,
      _feeRecipient,
      _bonusToken
    );
    require(_idToAddress[id] == address(0), "CREATED");
    string memory name;
    string memory symbol;

    {
      // create another scope to avoid stack-too-deep error
      IERC20WithDetail token = IERC20WithDetail(_token);
      string memory tokenName = token.name();
      name = _concat("Hodl", tokenName);

      string memory tokenSymbol = token.symbol();
      symbol = _concat("h", tokenSymbol);
    }

    bytes memory initializationCalldata = abi.encodeWithSelector(
      IHodlERC20(implementation).init.selector,
      _token,
      _penalty,
      _lockWindow,
      _expiry,
      _fee,
      _n,
      _feeRecipient,
      name,
      symbol,
      _bonusToken
    );

    newHodl = _spawn(implementation, initializationCalldata);

    _isValidHToken[newHodl] = true;
    _idToAddress[id] = newHodl;

    emit HodlCreated(
      newHodl,
      _token,
      _penalty,
      _lockWindow,
      _expiry,
      _fee,
      _n,
      _feeRecipient,
      msg.sender,
      _bonusToken
    );

    return newHodl;
  }

  /**
   * @notice if no hToken has been created with these parameters, it will return address(0)
   * @param _token token to hold
   * @param _penalty penalty 1 out of 1000
   * @param _lockWindow duration locked before expiry
   * @param _expiry expiry timestamp
   * @param _fee fee out of every 1000 penalty
   * @param _feeRecipient address that collects fees
   * @param _bonusToken extra token for donations
   * @return
   */
  function getCreatedHToken(
    address _token,
    uint256 _penalty,
    uint256 _lockWindow,
    uint256 _expiry,
    uint256 _fee,
    uint256 _n,
    address _feeRecipient,
    address _bonusToken
  ) external view returns (address) {
    bytes32 id = _getHodlId(
      _token,
      _penalty,
      _lockWindow,
      _expiry,
      _fee,
      _n,
      _feeRecipient,
      _bonusToken
    );
    return _idToAddress[id];
  }

  /**
   * @notice get the address at which a new hToken with these parameters would be deployed
   * @dev return the exact address that will be deployed at with _computeAddress
   * @param _token token to hold
   * @param _penalty penalty 1 out of 1000
   * @param _lockWindow duration locked before expiry
   * @param _expiry expiry timestamp
   * @param _fee fee out of every 1000 penalty
   * @param _feeRecipient address that collect fees
   * @param _bonusToken extra token for donations
   * @return
   */
  function getTargetHTokenAddress(
    address _token,
    uint256 _penalty,
    uint256 _lockWindow,
    uint256 _expiry,
    uint256 _fee,
    uint256 _n,
    address _feeRecipient,
    address _bonusToken
  ) external view returns (address) {
    address _implementation = implementation;
    string memory name;
    string memory symbol;

    // create another scope to avoid stack-too-deep error
    {
      IERC20WithDetail token = IERC20WithDetail(_token);
      string memory tokenName = token.name();
      name = _concat("Hodl", tokenName);

      string memory tokenSymbol = token.symbol();
      symbol = _concat("h", tokenSymbol);
    }

    bytes memory initializationCalldata = abi.encodeWithSelector(
      IHodlERC20(_implementation).init.selector,
      _token,
      _penalty,
      _lockWindow,
      _expiry,
      _fee,
      _n,
      _feeRecipient,
      name,
      symbol,
      _bonusToken
    );
    return _computeAddress(_implementation, initializationCalldata);
  }

  /**
   * @dev hash parameters and get a unique hToken id
   * @param _token token to hold
   * @param _penalty penalty 1 out of 1000
   * @param _lockWindow duration locked before expiry
   * @param _expiry expiry timestamp
   * @param _fee fee out of every 1000 penalty
   * @param _feeRecipient address that collect fees
   * @param _bonusToken extra token for donations
   * @return id the unique id of an hToken
   */
  function _getHodlId(
    address _token,
    uint256 _penalty,
    uint256 _lockWindow,
    uint256 _expiry,
    uint256 _fee,
    uint256 _n,
    address _feeRecipient,
    address _bonusToken
  ) internal pure returns (bytes32) {
    return
      keccak256(
        abi.encodePacked(
          _token,
          _penalty,
          _lockWindow,
          _expiry,
          _fee,
          _n,
          _feeRecipient,
          _bonusToken
        )
      );
  }

  function _concat(string memory a, string memory b) internal pure returns (string memory) {
    return string(abi.encodePacked(a, b));
  }
}
