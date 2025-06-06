module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/Quantum_Portal'], // Ensure Jest looks for tests inside Quantum_Portal
  moduleDirectories: ['node_modules', '<rootDir>/Quantum_Portal'], // Helps resolve modules correctly
  // Add any other necessary Jest configurations here
  // For example, if you have path aliases in tsconfig.json:
  // moduleNameMapper: {
  //   '^@/lib/(.*)$': '<rootDir>/Quantum_Portal/lib/$1',
  //   '^@/models/(.*)$': '<rootDir>/Quantum_Portal/models/$1',
  // },
};
